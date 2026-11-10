import {Injectable} from '@nestjs/common';
import {createHash, randomUUID} from 'node:crypto';
import {z} from 'zod';
import {Database, Row} from '../../database/database';
import {conflict, invalid, notFound} from '../../common/errors';
import {CvsService} from '../cvs/cvs.service';
import {
  CreateDeliveryJobRequest,
  CreateDeliveryTaskRequest,
  DeliveryJobResource,
  DeliveryMatchCondition,
  DeliveryPreferencesRequest,
  DeliveryPreferencesResource,
  DeliveryTaskItemResource,
  DeliveryTaskList,
  DeliveryTaskResource,
} from './delivery.dto';

type StoredPreferences = {
  includeKeywords: string[];
  excludeKeywords: string[];
  cities: string[];
  salaryMinK: number | null;
  salaryMaxK: number | null;
  excludedCompanies: string[];
  greetingTemplate: string;
};
type StoredJob = {
  id: string;
  source: 'manual';
  title: string;
  company: string;
  city: string;
  salaryMinK: number | null;
  salaryMaxK: number | null;
  description: string;
  sourceUrl: string | null;
  createTime: string;
};

const emptyPreferences: StoredPreferences = {
  includeKeywords: [],
  excludeKeywords: [],
  cities: [],
  salaryMinK: null,
  salaryMaxK: null,
  excludedCompanies: [],
  greetingTemplate: '您好，我关注到贵司的「{{jobTitle}}」岗位，希望进一步了解该职位。',
};

function parse(value: unknown): unknown {
  return typeof value === 'string' ? JSON.parse(value) : value;
}

function parseStrings(value: unknown): string[] {
  const parsed = parse(value);
  if (!Array.isArray(parsed) || parsed.some((item) => typeof item !== 'string'))
    throw invalid('Stored delivery preferences are invalid.');
  return parsed;
}

function optionalNumber(value: unknown): number | null {
  return value === null || value === undefined ? null : Number(value);
}

function isoTime(value: unknown): string {
  return new Date(`${String(value).replace(' ', 'T').replace(/Z$/, '')}Z`).toISOString();
}

function normalize(value: string): string {
  return value.trim().toLocaleLowerCase('zh-CN').replace(/\s+/g, '');
}

function uniqueText(values: string[], field: string, maxItems: number): string[] {
  const normalized = values.map((value) => value.trim()).filter(Boolean);
  if (normalized.length > maxItems) throw invalid(`Too many ${field}.`);
  return [...new Set(normalized)];
}

function validateZhipinUrl(value: string | undefined): string | null {
  const sourceUrl = value?.trim() || '';
  if (!sourceUrl) return null;
  let parsed: URL;
  try {
    parsed = new URL(sourceUrl);
  } catch {
    throw invalid('Job source URL must be a valid BOSS webpage link.');
  }
  if (
    parsed.protocol !== 'https:' ||
    parsed.username !== '' ||
    parsed.password !== '' ||
    (parsed.hostname !== 'zhipin.com' && !parsed.hostname.endsWith('.zhipin.com'))
  )
    throw invalid('Job source URL must use the official zhipin.com domain.');
  return parsed.toString();
}

function addCondition(
  conditions: DeliveryMatchCondition[],
  key: string,
  label: string,
  status: DeliveryMatchCondition['status'],
  explanation: string,
): void {
  conditions.push({key, label, status, explanation});
}

function matchJob(job: StoredJob, preferences: StoredPreferences): DeliveryJobResource {
  const conditions: DeliveryMatchCondition[] = [];
  const text = normalize(`${job.title}\n${job.description}`);
  if (!preferences.includeKeywords.length) {
    addCondition(
      conditions,
      'includeKeywords',
      '职位关键词',
      'notConfigured',
      '未设置必需关键词。',
    );
  } else if (preferences.includeKeywords.some((keyword) => text.includes(normalize(keyword)))) {
    addCondition(
      conditions,
      'includeKeywords',
      '职位关键词',
      'matched',
      '命中至少一个必需关键词。',
    );
  } else {
    addCondition(conditions, 'includeKeywords', '职位关键词', 'mismatched', '没有命中必需关键词。');
  }

  if (!preferences.excludeKeywords.length) {
    addCondition(
      conditions,
      'excludeKeywords',
      '排除关键词',
      'notConfigured',
      '未设置排除关键词。',
    );
  } else if (preferences.excludeKeywords.some((keyword) => text.includes(normalize(keyword)))) {
    addCondition(
      conditions,
      'excludeKeywords',
      '排除关键词',
      'mismatched',
      '岗位内容命中排除关键词。',
    );
  } else {
    addCondition(conditions, 'excludeKeywords', '排除关键词', 'matched', '未命中排除关键词。');
  }

  if (!preferences.cities.length) {
    addCondition(conditions, 'cities', '城市', 'notConfigured', '未设置城市范围。');
  } else if (!job.city.trim()) {
    addCondition(conditions, 'cities', '城市', 'unknown', '岗位未提供城市，需要人工核对。');
  } else if (preferences.cities.some((city) => normalize(job.city).includes(normalize(city)))) {
    addCondition(conditions, 'cities', '城市', 'matched', '岗位城市符合已设置范围。');
  } else {
    addCondition(conditions, 'cities', '城市', 'mismatched', '岗位城市不在已设置范围内。');
  }

  if (preferences.salaryMinK === null && preferences.salaryMaxK === null) {
    addCondition(conditions, 'salary', '月薪', 'notConfigured', '未设置月薪范围。');
  } else if (job.salaryMinK === null || job.salaryMaxK === null) {
    const definitelyTooLow =
      preferences.salaryMinK !== null &&
      job.salaryMaxK !== null &&
      job.salaryMaxK < preferences.salaryMinK;
    const definitelyTooHigh =
      preferences.salaryMaxK !== null &&
      job.salaryMinK !== null &&
      job.salaryMinK > preferences.salaryMaxK;
    if (definitelyTooLow || definitelyTooHigh) {
      addCondition(conditions, 'salary', '月薪', 'mismatched', '岗位薪资不符合已设置范围。');
    } else {
      addCondition(conditions, 'salary', '月薪', 'unknown', '岗位薪资信息不完整，需要人工核对。');
    }
  } else if (
    (preferences.salaryMinK !== null && job.salaryMaxK < preferences.salaryMinK) ||
    (preferences.salaryMaxK !== null && job.salaryMinK > preferences.salaryMaxK)
  ) {
    addCondition(conditions, 'salary', '月薪', 'mismatched', '岗位薪资不符合已设置范围。');
  } else {
    addCondition(conditions, 'salary', '月薪', 'matched', '岗位薪资与已设置范围有交集。');
  }

  if (!preferences.excludedCompanies.length) {
    addCondition(conditions, 'excludedCompanies', '公司排除', 'notConfigured', '未设置排除公司。');
  } else if (
    preferences.excludedCompanies.some((company) =>
      normalize(job.company).includes(normalize(company)),
    )
  ) {
    addCondition(
      conditions,
      'excludedCompanies',
      '公司排除',
      'mismatched',
      '公司名称命中排除列表。',
    );
  } else {
    addCondition(
      conditions,
      'excludedCompanies',
      '公司排除',
      'matched',
      '公司名称未命中排除列表。',
    );
  }

  const statuses = conditions.map((condition) => condition.status);
  const matchStatus: DeliveryJobResource['matchStatus'] = statuses.includes('mismatched')
    ? 'excluded'
    : statuses.includes('unknown')
      ? 'review'
      : statuses.every((status) => status === 'notConfigured')
        ? 'unfiltered'
        : 'eligible';
  return {...job, matchStatus, conditions};
}

const taskItemSchema = z.strictObject({
  jobId: z.string().uuid(),
  title: z.string().min(1).max(200),
  company: z.string().min(1).max(200),
  city: z.string().max(120),
  salaryMinK: z.number().int().min(0).max(1000).nullable(),
  salaryMaxK: z.number().int().min(0).max(1000).nullable(),
  description: z.string().max(20000),
  sourceUrl: z.string().max(2048).nullable(),
  jobCreateTime: z.string().datetime(),
  matchStatus: z.enum(['eligible', 'review', 'excluded', 'unfiltered']),
  conditions: z.array(
    z.strictObject({
      key: z.string().max(40),
      label: z.string().max(80),
      status: z.enum(['matched', 'mismatched', 'unknown', 'notConfigured']),
      explanation: z.string().max(240),
    }),
  ),
  greeting: z.string().max(500),
});
const taskItemsSchema = z.array(taskItemSchema).min(1).max(50);
const taskSnapshotSchema = z.strictObject({
  preferences: z.unknown(),
  items: taskItemsSchema,
});

function renderGreeting(template: string, job: StoredJob): string {
  return template
    .replace(/\{\{\s*company\s*\}\}/g, job.company)
    .replace(/\{\{\s*jobTitle\s*\}\}/g, job.title)
    .replace(/\{\{\s*city\s*\}\}/g, job.city);
}

function digest(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

@Injectable()
export class DeliveryService {
  constructor(
    private readonly db: Database,
    private readonly cvs: CvsService,
  ) {}

  async preferences(owner: string): Promise<DeliveryPreferencesResource> {
    const [row] = await this.db.rows(
      'SELECT include_keywords,exclude_keywords,cities,salary_min_k,salary_max_k,excluded_companies,greeting_template,update_time FROM delivery_preferences WHERE owner_id=?',
      [owner],
    );
    if (!row) return {...emptyPreferences, updateTime: null};
    return {
      includeKeywords: parseStrings(row.include_keywords),
      excludeKeywords: parseStrings(row.exclude_keywords),
      cities: parseStrings(row.cities),
      salaryMinK: optionalNumber(row.salary_min_k),
      salaryMaxK: optionalNumber(row.salary_max_k),
      excludedCompanies: parseStrings(row.excluded_companies),
      greetingTemplate: String(row.greeting_template),
      updateTime: isoTime(row.update_time),
    };
  }

  async updatePreferences(
    owner: string,
    request: DeliveryPreferencesRequest,
  ): Promise<DeliveryPreferencesResource> {
    const preferences: StoredPreferences = {
      includeKeywords: uniqueText(request.includeKeywords, 'include keywords', 30),
      excludeKeywords: uniqueText(request.excludeKeywords, 'exclude keywords', 30),
      cities: uniqueText(request.cities, 'cities', 20),
      salaryMinK: request.salaryMinK ?? null,
      salaryMaxK: request.salaryMaxK ?? null,
      excludedCompanies: uniqueText(request.excludedCompanies, 'excluded companies', 30),
      greetingTemplate: request.greetingTemplate.trim(),
    };
    if (
      preferences.salaryMinK !== null &&
      preferences.salaryMaxK !== null &&
      preferences.salaryMinK > preferences.salaryMaxK
    )
      throw invalid('Minimum salary must not exceed maximum salary.');
    if (!preferences.greetingTemplate) throw invalid('Greeting template is required.');
    await this.db.run(
      'INSERT INTO delivery_preferences(owner_id,include_keywords,exclude_keywords,cities,salary_min_k,salary_max_k,excluded_companies,greeting_template,update_time) VALUES (?,?,?,?,?,?,?,?,UTC_TIMESTAMP(6)) ON DUPLICATE KEY UPDATE include_keywords=VALUES(include_keywords),exclude_keywords=VALUES(exclude_keywords),cities=VALUES(cities),salary_min_k=VALUES(salary_min_k),salary_max_k=VALUES(salary_max_k),excluded_companies=VALUES(excluded_companies),greeting_template=VALUES(greeting_template),update_time=UTC_TIMESTAMP(6)',
      [
        owner,
        JSON.stringify(preferences.includeKeywords),
        JSON.stringify(preferences.excludeKeywords),
        JSON.stringify(preferences.cities),
        preferences.salaryMinK,
        preferences.salaryMaxK,
        JSON.stringify(preferences.excludedCompanies),
        preferences.greetingTemplate,
      ],
    );
    return this.preferences(owner);
  }

  private async readPreferences(owner: string): Promise<StoredPreferences> {
    return this.preferences(owner);
  }

  private jobResource(row: Row): StoredJob {
    return {
      id: String(row.id),
      source: 'manual',
      title: String(row.title),
      company: String(row.company),
      city: String(row.city),
      salaryMinK: optionalNumber(row.salary_min_k),
      salaryMaxK: optionalNumber(row.salary_max_k),
      description: String(row.description),
      sourceUrl: row.source_url === null ? null : String(row.source_url),
      createTime: isoTime(row.create_time),
    };
  }

  async listJobs(owner: string): Promise<{jobs: DeliveryJobResource[]; totalSize: number}> {
    const [rows, preferences] = await Promise.all([
      this.db.rows(
        'SELECT id,title,company,city,salary_min_k,salary_max_k,description,source_url,create_time FROM delivery_jobs WHERE owner_id=? ORDER BY create_time DESC,id',
        [owner],
      ),
      this.readPreferences(owner),
    ]);
    return {
      jobs: rows.map((row) => matchJob(this.jobResource(row), preferences)),
      totalSize: rows.length,
    };
  }

  async createJob(owner: string, request: CreateDeliveryJobRequest): Promise<DeliveryJobResource> {
    const title = request.title.trim();
    const company = request.company.trim();
    const city = request.city.trim();
    const description = request.description.trim();
    if (!title || !company) throw invalid('Job title and company are required.');
    if (
      request.salaryMinK !== null &&
      request.salaryMinK !== undefined &&
      request.salaryMaxK !== null &&
      request.salaryMaxK !== undefined &&
      request.salaryMinK > request.salaryMaxK
    )
      throw invalid('Minimum salary must not exceed maximum salary.');
    const sourceUrl = validateZhipinUrl(request.sourceUrl);
    const id = randomUUID();
    await this.db.run(
      'INSERT INTO delivery_jobs(id,owner_id,title,company,city,salary_min_k,salary_max_k,description,source_url,create_time) VALUES (?,?,?,?,?,?,?,?,?,UTC_TIMESTAMP(6))',
      [
        id,
        owner,
        title,
        company,
        city,
        request.salaryMinK ?? null,
        request.salaryMaxK ?? null,
        description,
        sourceUrl,
      ],
    );
    const [row] = await this.db.rows(
      'SELECT id,title,company,city,salary_min_k,salary_max_k,description,source_url,create_time FROM delivery_jobs WHERE id=? AND owner_id=?',
      [id, owner],
    );
    if (!row) throw notFound();
    return matchJob(this.jobResource(row), await this.readPreferences(owner));
  }

  async deleteJob(owner: string, id: string): Promise<void> {
    const result = await this.db.run('DELETE FROM delivery_jobs WHERE id=? AND owner_id=?', [
      id,
      owner,
    ]);
    if (result.affectedRows !== 1) throw notFound();
  }

  private taskResource(row: Row): DeliveryTaskResource {
    let snapshot: unknown;
    try {
      snapshot = parse(row.task_snapshot);
    } catch {
      throw invalid('Stored delivery task is invalid.');
    }
    const parsedSnapshot = taskSnapshotSchema.safeParse(snapshot);
    if (!parsedSnapshot.success) throw invalid('Stored delivery task is invalid.');
    const status = String(row.status);
    if (status !== 'draft' && status !== 'simulated')
      throw invalid('Stored delivery task has an unsupported status.');
    return {
      id: String(row.id),
      status,
      cvId: String(row.cv_id),
      cvEtag: String(row.cv_etag),
      cvName: String(row.cv_name),
      cvFingerprint: String(row.cv_fingerprint),
      items: parsedSnapshot.data.items,
      createTime: isoTime(row.create_time),
      simulationTime: row.simulation_time ? isoTime(row.simulation_time) : null,
    };
  }

  private async findTask(owner: string, id: string): Promise<Row | undefined> {
    const [row] = await this.db.rows(
      'SELECT id,owner_id,request_fingerprint,cv_id,cv_etag,cv_name,cv_fingerprint,task_snapshot,status,create_time,simulation_time FROM delivery_tasks WHERE id=? AND owner_id=?',
      [id, owner],
    );
    return row;
  }

  async createTask(
    owner: string,
    request: CreateDeliveryTaskRequest,
  ): Promise<DeliveryTaskResource> {
    if (!request.jobIds.length) throw invalid('At least one job must be selected.');
    if (new Set(request.jobIds).size !== request.jobIds.length)
      throw invalid('Duplicate job IDs are not allowed.');

    const requestShape = JSON.stringify({
      cvId: request.cvId,
      cvEtag: request.cvEtag,
      jobIds: request.jobIds,
    });
    const requestFingerprint = digest(requestShape);
    const [existing] = await this.db.rows(
      'SELECT id,owner_id,request_fingerprint,cv_id,cv_etag,cv_name,cv_fingerprint,task_snapshot,status,create_time,simulation_time FROM delivery_tasks WHERE owner_id=? AND request_id=?',
      [owner, request.requestId],
    );
    if (existing) {
      if (String(existing.request_fingerprint) !== requestFingerprint) throw conflict();
      return this.taskResource(existing);
    }

    const cv = await this.cvs.getVersion(request.cvId, owner, request.cvEtag);
    const preferences = await this.readPreferences(owner);
    const cvSnapshot = JSON.stringify(cv);
    const cvFingerprint = digest(cvSnapshot);
    const taskId = randomUUID();

    return this.db.transaction(async (connection) => {
      const [account] = await this.db.rows(
        'SELECT id FROM accounts WHERE id=? AND status=? FOR UPDATE',
        [owner, 'active'],
        connection,
      );
      if (!account) throw notFound();
      const [raced] = await this.db.rows(
        'SELECT id,owner_id,request_fingerprint,cv_id,cv_etag,cv_name,cv_fingerprint,task_snapshot,status,create_time,simulation_time FROM delivery_tasks WHERE owner_id=? AND request_id=? FOR UPDATE',
        [owner, request.requestId],
        connection,
      );
      if (raced) {
        if (String(raced.request_fingerprint) !== requestFingerprint) throw conflict();
        return this.taskResource(raced);
      }
      const placeholders = request.jobIds.map(() => '?').join(',');
      const rows = await this.db.rows(
        `SELECT id,title,company,city,salary_min_k,salary_max_k,description,source_url,create_time FROM delivery_jobs WHERE owner_id=? AND id IN (${placeholders})`,
        [owner, ...request.jobIds],
        connection,
      );
      const byId = new Map(rows.map((row) => [String(row.id), this.jobResource(row)]));
      const selectedJobs: StoredJob[] = [];
      for (const id of request.jobIds) {
        const job = byId.get(id);
        if (!job) throw notFound();
        selectedJobs.push(job);
      }
      const items: DeliveryTaskItemResource[] = selectedJobs.map((job) => {
        const matched = matchJob(job, preferences);
        if (matched.matchStatus === 'excluded')
          throw invalid('A selected job no longer matches the saved hard filters.');
        return {
          jobId: matched.id,
          title: matched.title,
          company: matched.company,
          city: matched.city,
          salaryMinK: matched.salaryMinK,
          salaryMaxK: matched.salaryMaxK,
          description: matched.description,
          sourceUrl: matched.sourceUrl,
          jobCreateTime: matched.createTime,
          matchStatus: matched.matchStatus,
          conditions: matched.conditions,
          greeting: renderGreeting(preferences.greetingTemplate, matched),
        };
      });
      const snapshot = JSON.stringify({preferences, items});
      await this.db.run(
        'INSERT INTO delivery_tasks(id,owner_id,request_id,request_fingerprint,cv_id,cv_etag,cv_name,cv_fingerprint,cv_snapshot,task_snapshot,status,create_time,simulation_time) VALUES (?,?,?,?,?,?,?,?,?,?,?,UTC_TIMESTAMP(6),NULL)',
        [
          taskId,
          owner,
          request.requestId,
          requestFingerprint,
          cv.id,
          cv.etag,
          cv.displayName,
          cvFingerprint,
          cvSnapshot,
          snapshot,
          'draft',
        ],
        connection,
      );
      const [created] = await this.db.rows(
        'SELECT id,owner_id,request_fingerprint,cv_id,cv_etag,cv_name,cv_fingerprint,task_snapshot,status,create_time,simulation_time FROM delivery_tasks WHERE id=? AND owner_id=?',
        [taskId, owner],
        connection,
      );
      if (!created) throw notFound();
      return this.taskResource(created);
    });
  }

  async listTasks(owner: string, pageSize: number, pageToken: string): Promise<DeliveryTaskList> {
    if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100)
      throw invalid('Invalid page size.');
    let offset = 0;
    if (pageToken) {
      try {
        offset = Number(Buffer.from(pageToken, 'base64url').toString());
      } catch {
        throw invalid('Invalid page token.');
      }
      if (!Number.isSafeInteger(offset) || offset < 0 || offset > 1000000)
        throw invalid('Invalid page token.');
    }
    const rows = await this.db.rows(
      `SELECT id,owner_id,request_fingerprint,cv_id,cv_etag,cv_name,cv_fingerprint,task_snapshot,status,create_time,simulation_time FROM delivery_tasks WHERE owner_id=? ORDER BY create_time DESC,id LIMIT ${pageSize + 1} OFFSET ${offset}`,
      [owner],
    );
    const hasNextPage = rows.length > pageSize;
    return {
      tasks: rows.slice(0, pageSize).map((row) => this.taskResource(row)),
      nextPageToken: hasNextPage
        ? Buffer.from(String(offset + pageSize)).toString('base64url')
        : '',
    };
  }

  async getTask(owner: string, id: string): Promise<DeliveryTaskResource> {
    const row = await this.findTask(owner, id);
    if (!row) throw notFound();
    return this.taskResource(row);
  }

  async simulateTask(owner: string, id: string): Promise<DeliveryTaskResource> {
    await this.db.run(
      'UPDATE delivery_tasks SET status=?,simulation_time=UTC_TIMESTAMP(6) WHERE id=? AND owner_id=? AND status=?',
      ['simulated', id, owner, 'draft'],
    );
    const row = await this.findTask(owner, id);
    if (!row) throw notFound();
    if (String(row.status) !== 'simulated')
      throw invalid('Only a draft offline task can be simulated.');
    return this.taskResource(row);
  }

  async deleteTask(owner: string, id: string): Promise<void> {
    const result = await this.db.run('DELETE FROM delivery_tasks WHERE id=? AND owner_id=?', [
      id,
      owner,
    ]);
    if (result.affectedRows !== 1) throw notFound();
  }
}
