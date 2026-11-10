declare namespace API {
  type AccountResource = {
    id: string;
    email: string | null;
    displayName: string;
    avatar: string | null;
    publicId: string;
    emailVerified: boolean;
    githubConnected: boolean;
  };

  type AccountUpdate = {
    displayName: string;
    avatar?: string | null;
  };

  type AiAnalysisContent = {
    summary: string;
    findings: AiFinding[];
    suggestions: AiSuggestion[];
    greeting: string;
  };

  type AiAnalysisInputField = {
    fieldId: string;
    label: string;
    text: string;
  };

  type AiAnalysisPreview = {
    cvId: string;
    cvEtag: string;
    provider: "volcengine" | "deepseek" | "openai";
    modelId: string;
    providerConfigUpdateTime: string;
    operation: "diagnose" | "jobMatch" | "improve" | "greeting";
    inputFields: AiAnalysisInputField[];
    targetFieldOptions: AiAnalysisInputField[];
    jobDescription: string;
    retentionDays: number;
  };

  type AiConnectionTestRequest = {
    requestId: string;
  };

  type AiConnectionTestResult = {
    provider: "volcengine" | "deepseek" | "openai";
    modelId: string;
    connected: boolean;
    requestId: string;
    inputTokens: number | null;
    outputTokens: number | null;
  };

  type AiFinding = {
    kind: "strength" | "gap" | "unknown";
    title: string;
    status: "supported" | "missing" | "unknown";
    fieldId: string | null;
    evidence: string;
    explanation: string;
  };

  type AiProviderList = {
    providers: AiProviderStatus[];
  };

  type AiProviderStatus = {
    provider: "volcengine" | "deepseek" | "openai";
    displayName: string;
    protocol: string;
    officialHost: string;
    configured: boolean;
    encryptionReady: boolean;
    modelId: string | null;
    keySuffix: string | null;
    updateTime: string | null;
  };

  type AiReportList = {
    reports: AiReportSummary[];
    nextPageToken: string;
  };

  type AiReportResource = {
    id: string;
    cvId: string;
    cvEtag: string;
    provider: "volcengine" | "deepseek" | "openai";
    modelId: string;
    operation: "diagnose" | "jobMatch" | "improve" | "greeting";
    promptVersion: string;
    status: "succeeded" | "failed" | "unknown" | "running";
    inputFields: AiAnalysisInputField[];
    jobDescription: string;
    result: AiAnalysisContent | null;
    usage: AiUsageResource;
    createTime: string;
    expireTime: string;
  };

  type AiReportSummary = {
    id: string;
    cvId: string;
    cvEtag: string;
    provider: "volcengine" | "deepseek" | "openai";
    modelId: string;
    operation: "diagnose" | "jobMatch" | "improve" | "greeting";
    status: "succeeded" | "failed" | "unknown" | "running";
    createTime: string;
    expireTime: string;
  };

  type AiSuggestion = {
    targetFieldId: string;
    sourceText: string;
    proposedText: string;
    explanation: string;
  };

  type AiUsageResource = {
    inputTokens: number | null;
    outputTokens: number | null;
  };

  type AnalyzeCvRequest = {
    cvId: string;
    etag: string;
    provider: "volcengine" | "deepseek" | "openai";
    operation: "diagnose" | "jobMatch" | "improve" | "greeting";
    jobDescription?: string;
    targetFieldId?: string;
    requestId: string;
    providerConfigUpdateTime: string;
  };

  type AuthOptions = {
    githubEnabled: boolean;
    legacyRegistrationEnabled: boolean;
    legacyRecoveryEnabled: boolean;
  };

  type authorizeGithubParams = {
    returnTo: string;
  };

  type BadRequest = {
    "@type": string;
    fieldViolations: FieldViolation[];
  };

  type ChangePasswordRequest = {
    password: string;
    newPassword: string;
  };

  type completeGithubParams = {
    state: string;
    code: string;
  };

  type copyCvParams = {
    id: string;
  };

  type CreateCVRequest = {
    displayName: string;
    requestId?: string;
    profile?: ProfileInput;
    sections?: SectionInput[];
    styleSettings?: StyleSettingsInput;
  };

  type Credentials = {
    email: string;
    password: string;
    displayName?: string;
  };

  type CvHistory = {
    retentionLimit: number;
    revisions: CvRevision[];
  };

  type CvList = {
    cvs: CVResource[];
    totalSize: number;
    nextPageToken: string;
  };

  type CVResource = {
    id: string;
    name: string;
    displayName: string;
    etag: string;
    profile: ProfileSchema;
    sections: SectionSchema[];
    styleSettings: StyleSettingsSchema;
    createTime: string;
    updateTime: string;
  };

  type CvRevision = {
    formatVersion: 1;
    id: string;
    createTime: string;
    document: CVResource;
  };

  type deleteAiProviderParams = {
    provider: string;
  };

  type deleteCvParams = {
    id: string;
  };

  type deletePresetParams = {
    id: string;
  };

  type ErrorBody = {
    code: number;
    status: string;
    message: string;
    details: (ErrorInfo | BadRequest)[];
  };

  type ErrorInfo = {
    "@type": string;
    domain: string;
    reason: string;
  };

  type ErrorResponse = {
    error: ErrorBody;
  };

  type exportCvPdfParams = {
    id: string;
    etag: string;
  };

  type exportCvPngParams = {
    id: string;
    etag: string;
  };

  type FieldViolation = {
    field: string;
    description: string;
  };

  type getAiReportParams = {
    id: string;
  };

  type getCvAvatarParams = {
    id: string;
  };

  type getCvParams = {
    id: string;
  };

  type getPrintContextParams = {
    ticket: string;
  };

  type getPublicResumeParams = {
    publicId: string;
  };

  type GithubConnection = {
    connected: boolean;
    login: string;
  };

  type GithubFeaturedProject = {
    id: string;
    name: string;
    fullName: string;
    url: string;
    description: string | null;
    language: string | null;
    stars: number;
    fork: boolean;
    updateTime: string;
    repositoryId: string;
    contribution: string;
    displayOrder: number;
  };

  type GithubFeaturedProjectInput = {
    repositoryId: string;
    contribution: string;
  };

  type GithubFeaturedProjects = {
    projects: GithubFeaturedProject[];
  };

  type GithubRepositories = {
    repositories: GithubRepository[];
    nextPageToken: string;
    syncTime: string;
  };

  type GithubRepository = {
    id: string;
    name: string;
    fullName: string;
    url: string;
    description: string | null;
    language: string | null;
    stars: number;
    fork: boolean;
    updateTime: string;
  };

  type Health = {
    status: "ok";
  };

  type ImportPosition = {
    x: number;
    y: number;
  };

  type ImportTextBlock = {
    kind: "heading" | "paragraph" | "list-item" | "table-row" | "line";
    order: number;
    text: string;
    page?: number;
    position?: ImportPosition;
  };

  type linkGithubParams = {
    returnTo: string;
  };

  type listAiReportsParams = {
    pageSize?: number;
    pageToken?: string;
  };

  type listCvRevisionsParams = {
    id: string;
  };

  type listCvsParams = {
    pageToken?: any;
    pageSize?: any;
  };

  type listGithubRepositoriesParams = {
    pageToken?: any;
  };

  type PreviewCvRequest = {
    cvId: string;
    etag: string;
    provider: "volcengine" | "deepseek" | "openai";
    operation: "diagnose" | "jobMatch" | "improve" | "greeting";
    jobDescription?: string;
    targetFieldId?: string;
  };

  type ProfileInput = {
    fullName?: string;
    headline?: string;
    email?: string;
    phone?: string;
    location?: string;
    website?: string;
    github?: string;
    wechat?: string;
    jobStatus?: string;
    expectedLocation?: string;
    experienceYears?: string;
    expectedSalary?: string;
    hiddenFields?: string[];
    photoHidden?: boolean;
    photoPosition?: "left" | "right";
    photoX?: number;
    photoY?: number;
    photoScale?: number;
    avatarUrl?: string | null;
  };

  type ProfileSchema = {
    fullName: string;
    headline: string;
    email: string;
    phone: string;
    location: string;
    website: string;
    github: string;
    wechat: string;
    jobStatus: string;
    expectedLocation: string;
    experienceYears: string;
    expectedSalary: string;
    hiddenFields: string[];
    photoHidden: boolean;
    photoPosition: "left" | "right";
    photoX: number;
    photoY: number;
    photoScale: number;
    avatarUrl: string | null;
  };

  type PublicationReview = {
    id: string;
    sourceName: string;
    document: ResumeDocument;
  };

  type PublicationStatus = {
    published: boolean;
    sourceName: string;
    updateTime: string;
    publicId: string;
    etag: string;
  };

  type PublicGithubProject = {
    repositoryId: string;
    name: string;
    fullName: string;
    url: string;
    description: string | null;
    language: string | null;
    stars: number;
    fork: boolean;
    updateTime: string;
    contribution: string;
  };

  type PublicSelection = {
    sourceId: string;
    etag: string;
    fields: string[];
    sectionIds: string[];
  };

  type PublishRequest = {
    reviewId: string;
  };

  type restoreCvRevisionParams = {
    id: string;
    revision: string;
  };

  type RestoreRequest = {
    requestId: string;
  };

  type ResumeDocument = {
    profile: ProfileSchema;
    sections: SectionSchema[];
    styleSettings: StyleSettingsSchema;
    projects?: PublicGithubProject[];
  };

  type ResumeImportCandidate = {
    format: "docx" | "pdf";
    pageCount?: number;
    blocks: ImportTextBlock[];
    warnings: string[];
  };

  type SaveGithubFeaturedProjects = {
    projects: GithubFeaturedProjectInput[];
  };

  type SectionInput = {
    id: string;
    type:
      | "summary"
      | "experience"
      | "education"
      | "project"
      | "skill"
      | "custom";
    title: string;
    visible?: boolean;
    content?: any;
    items?: SectionItemInput[];
  };

  type SectionItemInput = {
    id: string;
    title?: string;
    subtitle?: string;
    dateRange?: string;
    location?: string;
    description?: any;
    startDate?: string;
    endDate?: string;
    current?: boolean;
    degree?: string;
    educationType?: string;
    department?: string;
    link?: string;
    tags?: string[];
  };

  type SectionItemSchema = {
    id: string;
    title: string;
    subtitle: string;
    dateRange: string;
    location: string;
    description: any;
    startDate: string;
    endDate: string;
    current: boolean;
    degree: string;
    educationType: string;
    department: string;
    link: string;
    tags: string[];
  };

  type SectionSchema = {
    id: string;
    type:
      | "summary"
      | "experience"
      | "education"
      | "project"
      | "skill"
      | "custom";
    title: string;
    visible: boolean;
    content: any;
    items: SectionItemSchema[];
  };

  type StylePreset = {
    id: string;
    displayName: string;
    settings: StyleSettingsSchema;
  };

  type StyleSettingsInput = {
    accent?: "ink" | "blue" | "graphite";
    templateId?: "standard" | "compact" | "timeline";
    fontSize?: number;
    lineHeight?: number;
    margin?: number;
  };

  type StyleSettingsSchema = {
    accent: "ink" | "blue" | "graphite";
    templateId: "standard" | "compact" | "timeline";
    fontSize: number;
    lineHeight: number;
    margin: number;
  };

  type testAiProviderParams = {
    provider: string;
  };

  type updateAiProviderParams = {
    provider: string;
  };

  type UpdateAiProviderRequest = {
    /** Provider model or endpoint ID configured by the user. */
    modelId: string;
    /** Blank leaves the existing API Key unchanged. */
    apiKey?: string;
  };

  type updateCvParams = {
    id: string;
  };

  type UpdateCVRequest = {
    displayName?: string;
    requestId?: string;
    profile?: ProfileInput;
    sections?: SectionInput[];
    styleSettings?: StyleSettingsInput;
    etag?: string;
    updateMask?: string;
  };

  type uploadCvAvatarParams = {
    id: string;
  };

  type withdrawPublicationParams = {
    etag: string;
  };
}
