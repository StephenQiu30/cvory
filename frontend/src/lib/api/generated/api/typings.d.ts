declare namespace API {
  type AccountResource = {
    /** Id */
    id: string;
    /** Email */
    email: string;
    /** Displayname */
    displayName: string;
    /** Avatar */
    avatar?: string | null;
    /** Publicid */
    publicId: string;
  };

  type AccountUpdate = {
    /** Displayname */
    displayName: string;
    /** Avatar */
    avatar?: string | null;
  };

  type BodyUploadCvAvatar = {
    /** File 头像图片文件（支持 PNG、JPEG、WEBP 格式） */
    file: string;
  };

  type CreateCVRequest = {
    /** Requestid */
    requestId?: string | null;
    /** Displayname 新简历的显示名称 */
    displayName: string;
    /** 初始个人基本信息（可选，默认提供空白框架） */
    profile?: ProfileSchema | null;
    /** Sections 初始模块列表（可选，默认提供常用起步模块） */
    sections?: SectionSchema[] | null;
    /** 排版样式参数（可选，默认标准排版） */
    styleSettings?: StyleSettingsSchema | null;
  };

  type Credentials = {
    /** Email */
    email: string;
    /** Password */
    password: string;
    /** Displayname */
    displayName?: string;
  };

  type CVResource = {
    /** Name 资源稳定唯一资源名称，格式：cvs/{id} */
    name: string;
    /** Id 简历唯一标识 UUID */
    id: string;
    /** Displayname 用户设定的简历名称 */
    displayName: string;
    /** Etag 当前版本的内容特征哈希 ETag，用于并发安全修改校验 */
    etag: string;
    /** 个人基本信息与联系方式 */
    profile: ProfileSchema;
    /** Sections 有序的简历内容模块列表 */
    sections: SectionSchema[];
    /** 纸张排版与文字样式预设 */
    styleSettings: StyleSettingsSchema;
    /** Createtime 创建时间（RFC 3339 UTC 格式） */
    createTime: string;
    /** Updatetime 最近一次更新时间（RFC 3339 UTC 格式） */
    updateTime: string;
  };

  type deleteCvParams = {
    cv_id: string;
  };

  type deletePresetParams = {
    preset_id: string;
  };

  type ErrorBody = {
    /** Code HTTP 状态码 */
    code: number;
    /** Message 面向开发者的英文错误描述 */
    message: string;
    /** Status Google RPC 标准状态码，如 INVALID_ARGUMENT, ABORTED, NOT_FOUND */
    status: string;
    /** Details 错误扩展明细 */
    details?: ErrorDetail[];
  };

  type ErrorDetail = {
    /** @Type 错误详情类型标识 URL */
    "@type": string;
    /** Fieldviolations 字段校验详情列表 */
    fieldViolations?: FieldViolation[] | null;
    /** Reason 标准错误原因代码 */
    reason?: string | null;
    /** Domain 发生错误的业务域 */
    domain?: string | null;
  };

  type exportCvPdfParams = {
    cv_id: string;
    etag: string;
  };

  type FieldViolation = {
    /** Field 发生校验错误的字段路径 */
    field: string;
    /** Description 具体的错误原因说明 */
    description: string;
  };

  type getCvAvatarParams = {
    cv_id: string;
  };

  type getCvParams = {
    cv_id: string;
  };

  type getPrintContextParams = {
    ticket: string;
  };

  type getPublicResumeParams = {
    public_id: string;
  };

  type GoogleErrorResponse = {
    error: ErrorBody;
  };

  type HTTPValidationError = {
    /** Detail */
    detail?: ValidationError[];
  };

  type listCvsParams = {
    /** 单页最大返回数量（1-100） */
    pageSize?: number;
    /** 分页标记游标，上一页返回的 nextPageToken */
    pageToken?: string | null;
  };

  type ListCVsResponse = {
    /** Cvs 简历资源列表 */
    cvs?: CVResource[];
    /** Nextpagetoken 下一页分页游标 Token；若为空则说明已是最后一页 */
    nextPageToken?: string;
    /** Totalsize 当前所有者名下的简历总数量 */
    totalSize?: number;
  };

  type ProfileSchema = {
    /** Fullname 姓名 */
    fullName?: string;
    /** Headline 专业定位或一句话头衔 */
    headline?: string;
    /** Email 联系电子邮箱 */
    email?: string;
    /** Phone 联系电话 */
    phone?: string;
    /** Location 常驻城市 */
    location?: string;
    /** Website 个人网站或 GitHub 主页 */
    website?: string;
    /** Github */
    github?: string;
    /** Wechat */
    wechat?: string;
    /** Jobstatus */
    jobStatus?: string;
    /** Expectedlocation */
    expectedLocation?: string;
    /** Experienceyears */
    experienceYears?: string;
    /** Expectedsalary */
    expectedSalary?: string;
    /** Hiddenfields */
    hiddenFields?: string[];
    /** Photohidden */
    photoHidden?: boolean;
    /** Photoposition */
    photoPosition?: "left" | "right";
    /** Photox */
    photoX?: number;
    /** Photoy */
    photoY?: number;
    /** Photoscale */
    photoScale?: number;
    /** Avatarurl 个人头像资源访问 URL */
    avatarUrl?: string | null;
  };

  type PublicationReview = {
    /** Id */
    id: string;
    /** Sourcename */
    sourceName: string;
    document: ResumeDocument;
  };

  type PublicationStatus = {
    /** Published */
    published: boolean;
    /** Sourcename */
    sourceName?: string;
    /** Updatetime */
    updateTime?: string;
    /** Publicid */
    publicId: string;
  };

  type PublicSelection = {
    /** Sourceid */
    sourceId: string;
    /** Etag */
    etag: string;
    /** Fields */
    fields: string[];
    /** Sectionids */
    sectionIds: string[];
  };

  type PublishRequest = {
    /** Reviewid */
    reviewId: string;
  };

  type ResumeDocument = {
    profile: ProfileSchema;
    /** Sections */
    sections: SectionSchema[];
    styleSettings: StyleSettingsSchema;
  };

  type SectionItemSchema = {
    /** Id 子项稳定唯一标识 ID */
    id: string;
    /** Title 主标题（公司、学校或项目名） */
    title?: string;
    /** Subtitle 副标题（职位、专业或角色） */
    subtitle?: string;
    /** Daterange 起止时间跨度 */
    dateRange?: string;
    /** Location 所在地城市或办公地点 */
    location?: string;
    /** Description 详细职责与产出说明，支持 Tiptap JSON 格式或纯文本 */
    description?: any;
    /** Startdate */
    startDate?: string;
    /** Enddate */
    endDate?: string;
    /** Current */
    current?: boolean;
    /** Degree */
    degree?: string;
    /** Educationtype */
    educationType?: string;
    /** Department */
    department?: string;
    /** Link */
    link?: string;
    /** Tags 技术栈或高亮标签列表 */
    tags?: string[];
  };

  type SectionSchema = {
    /** Id 模块稳定唯一标识 ID */
    id: string;
    /** Type 模块类型：summary, experience, education, project, skill, custom */
    type:
      | "summary"
      | "experience"
      | "education"
      | "project"
      | "skill"
      | "custom";
    /** Title 模块对外展示标题 */
    title: string;
    /** Visible 模块是否可见（隐藏不会删除数据） */
    visible?: boolean;
    /** Content 直接富文本正文（常用于 summary 简介模块） */
    content?: any;
    /** Items 模块内的重复子项列表 */
    items?: SectionItemSchema[];
  };

  type StylePreset = {
    /** Id */
    id: string;
    /** Displayname */
    displayName: string;
    settings: StyleSettingsSchema;
  };

  type StyleSettingsSchema = {
    /** Accent */
    accent?: "ink" | "blue" | "graphite";
    /** Templateid 排版模板标识：standard（标准）或 compact（紧凑） */
    templateId?: "standard" | "compact" | "timeline";
    /** Fontsize 正文字号基线大小（像素 px） */
    fontSize?: number;
    /** Lineheight 正文排版行高比例 */
    lineHeight?: number;
    /** Margin 页面外边距尺寸（像素 px） */
    margin?: number;
  };

  type updateCvParams = {
    cv_id: string;
  };

  type UpdateCVRequest = {
    /** Displayname 更新后的简历名称 */
    displayName?: string | null;
    /** 更新后的个人信息 */
    profile?: ProfileSchema | null;
    /** Sections 更新后的完整模块列表（支持调整排序与可见性） */
    sections?: SectionSchema[] | null;
    /** 更新后的排版样式参数 */
    styleSettings?: StyleSettingsSchema | null;
    /** Etag 当前持有的资源 ETag。必须与服务端一致，否则拒绝写入并返回 409 ABORTED */
    etag?: string | null;
    /** Updatemask 字段掩码列表，逗号分隔，例如：displayName,profile,sections */
    updateMask?: string | null;
  };

  type uploadCvAvatarParams = {
    cv_id: string;
  };

  type ValidationError = {
    /** Location */
    loc: (string | number)[];
    /** Message */
    msg: string;
    /** Error Type */
    type: string;
    /** Input */
    input?: any;
    /** Context */
    ctx?: Record<string, any>;
  };
}
