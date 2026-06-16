/**
 * Zod schemas for all JSON blob columns in author_profiles.
 *
 * Each schema mirrors the TypeScript interface used by the enrichment layer.
 * All parse helpers return null on empty input or parse failure — callers
 * should treat null as "not enriched yet".
 *
 * Usage:
 *   const desc = parseAuthorDescription(row.authorDescriptionJson);
 *   if (desc) { // typed as AuthorDescription }
 */

import { z } from "zod";

// ── Helpers ────────────────────────────────────────────────────────────────────

function safeParse<T>(schema: z.ZodType<T>, raw: string | null | undefined): T | null {
  if (!raw) return null;
  try {
    return schema.parse(JSON.parse(raw));
  } catch {
    return null;
  }
}

// ── 1. authorDescriptionJson — AuthorDescription ──────────────────────────────

export const AuthorDescriptionSchema = z.object({
  authorName: z.string(),
  demographics: z.object({
    apparentAgeRange: z.string(),
    genderPresentation: z.enum(["male", "female", "non-binary"]),
    ethnicAppearance: z.string(),
  }),
  physicalFeatures: z.object({
    hair: z.object({
      color: z.string(),
      style: z.string(),
      length: z.string(),
      texture: z.string().optional(),
      hairline: z.string().optional(),
    }),
    facialHair: z.object({
      type: z.enum(["none", "beard", "goatee", "stubble", "mustache", "full beard"]),
      color: z.string().optional(),
      style: z.string().optional(),
    }),
    faceShape: z.string(),
    distinctiveFeatures: z.array(z.string()),
    eyes: z.object({
      color: z.string(),
      shape: z.string().optional(),
      notable: z.string().optional(),
      browShape: z.string().optional(),
      setting: z.string().optional(),
    }),
    skinTone: z.string(),
    build: z.string(),
    glasses: z.object({
      wears: z.boolean(),
      style: z.string().optional(),
    }),
  }),
  microFeatures: z.object({
    noseShape: z.string().optional(),
    lipDescription: z.string().optional(),
    lipFullness: z.string().optional(),
    lipShape: z.string().optional(),
    foreheadHeight: z.string().optional(),
    foreheadWidth: z.string().optional(),
    jawAngle: z.string().optional(),
    chinShape: z.string().optional(),
    cheekboneProminence: z.string().optional(),
    earShape: z.string().optional(),
    skinTexture: z.string().optional(),
    characteristicHeadTilt: z.string().optional(),
    distinctiveMarks: z.array(z.string()).optional(),
    generationNotes: z.string().optional(),
  }).optional(),
  characteristicPose: z.object({
    headAngle: z.string().optional(),
    shoulderPosition: z.string().optional(),
    gazeDirection: z.string().optional(),
    smileType: z.string().optional(),
    eyeEngagement: z.string().optional(),
  }).optional(),
  bestReferencePhotoUrl: z.string().optional(),
  stylePresentation: z.object({
    typicalAttire: z.object({
      formality: z.string(),
      description: z.string(),
      colors: z.array(z.string()),
    }),
    aesthetic: z.array(z.string()),
    visualSignatures: z.array(z.string()).optional(),
  }),
  personalityExpression: z.object({
    dominantTraits: z.array(z.string()),
    typicalExpression: z.string(),
    energy: z.string(),
    dominantExpression: z.string().optional(),
    smileType: z.string().optional(),
    eyeEngagement: z.string().optional(),
  }),
  professionalContext: z.object({
    primaryField: z.string(),
    roleType: z.string(),
    institutions: z.array(z.string()),
    notableWorks: z.array(z.string()).optional(),
  }),
  sourceConfidence: z.object({
    photoSourceCount: z.number(),
    photoConsistency: z.enum(["high", "medium", "low"]),
    overallConfidence: z.enum(["high", "medium", "low"]),
    uncertainties: z.array(z.string()),
    bestPhotoQuality: z.enum(["excellent", "good", "fair", "poor"]).optional(),
  }),
  references: z.object({
    photoUrls: z.array(z.string()),
    textSources: z.array(z.string()),
  }),
});

export type AuthorDescription = z.infer<typeof AuthorDescriptionSchema>;

export function parseAuthorDescription(raw: string | null | undefined): AuthorDescription | null {
  return safeParse(AuthorDescriptionSchema, raw);
}

// ── 2. socialStatsJson — SocialStatsResult ────────────────────────────────────

const GitHubStatsSchema = z.object({
  username: z.string(),
  profileUrl: z.string(),
  followers: z.number(),
  following: z.number(),
  publicRepos: z.number(),
  publicGists: z.number(),
  totalStars: z.number(),
  bio: z.string().nullable(),
  blog: z.string().nullable(),
  company: z.string().nullable(),
  location: z.string().nullable(),
  twitterUsername: z.string().nullable(),
  fetchedAt: z.string(),
});

const WikipediaStatsSchema = z.object({
  pageTitle: z.string(),
  pageUrl: z.string(),
  description: z.string().nullable(),
  extract: z.string().nullable(),
  thumbnailUrl: z.string().nullable(),
  avgMonthlyViews: z.number(),
  fetchedAt: z.string(),
});

const SubstackStatsSchema = z.object({
  substackUrl: z.string(),
  subdomain: z.string(),
  postCount: z.number(),
  subscriberRange: z.string().nullable(),
  followerCount: z.number().nullable(),
  fetchedAt: z.string(),
});

const YCStatsSchema = z.object({
  isYCFounder: z.boolean(),
  companyName: z.string().nullable(),
  batch: z.string().nullable(),
  status: z.string().nullable(),
  shortDescription: z.string().nullable(),
  ycPageUrl: z.string().nullable(),
  companyWebsite: z.string().nullable(),
  fetchedAt: z.string(),
});

const CNNArticleSchema = z.object({
  title: z.string(),
  url: z.string(),
  publishedAt: z.string().nullable(),
  author: z.string().nullable(),
});

const CNNStatsSchema = z.object({
  articleCount: z.number(),
  recentArticles: z.array(CNNArticleSchema),
  latestArticleDate: z.string().nullable(),
  searchQuery: z.string(),
  fetchedAt: z.string(),
});

const TwitterStatsSchema = z.object({
  userId: z.string(),
  username: z.string(),
  name: z.string(),
  followerCount: z.number(),
  followingCount: z.number(),
  tweetCount: z.number(),
  listedCount: z.number(),
  verified: z.boolean(),
  profileUrl: z.string(),
  fetchedAt: z.string(),
});

const YahooFinanceStatsSchema = z.object({
  ticker: z.string(),
  shortName: z.string(),
  regularMarketPrice: z.number().nullable(),
  marketCap: z.number().nullable(),
  currency: z.string().nullable(),
  exchange: z.string().nullable(),
  fiftyTwoWeekHigh: z.number().nullable(),
  fiftyTwoWeekLow: z.number().nullable(),
  fetchedAt: z.string(),
});

const LinkedInStatsSchema = z.object({
  followerCount: z.number().nullable(),
  connectionCount: z.number().nullable(),
  headline: z.string().nullable(),
  profileUrl: z.string(),
  fetchedAt: z.string(),
});

const SeekingAlphaStatsSchema = z.object({
  articleCount: z.number(),
  recentArticles: z.array(z.object({ title: z.string(), url: z.string(), date: z.string().nullable() })),
  latestArticleDate: z.string().nullable(),
  fetchedAt: z.string(),
});

export const SocialStatsSchema = z.object({
  github: GitHubStatsSchema.optional(),
  wikipedia: WikipediaStatsSchema.optional(),
  substack: SubstackStatsSchema.optional(),
  ycombinator: YCStatsSchema.optional(),
  cnn: CNNStatsSchema.optional(),
  twitter: TwitterStatsSchema.optional(),
  yahooFinance: YahooFinanceStatsSchema.optional(),
  linkedin: LinkedInStatsSchema.optional(),
  seekingAlpha: SeekingAlphaStatsSchema.optional(),
  enrichedAt: z.string(),
  platformsAttempted: z.array(z.string()),
  platformsSucceeded: z.array(z.string()),
});

export type SocialStats = z.infer<typeof SocialStatsSchema>;

export function parseSocialStats(raw: string | null | undefined): SocialStats | null {
  return safeParse(SocialStatsSchema, raw);
}

// ── 3. newspaperArticlesJson — NewspaperArticle[] ─────────────────────────────

export const NewspaperArticleSchema = z.object({
  title: z.string(),
  url: z.string(),
  date: z.string().nullable().optional(),
  publication: z.string().nullable().optional(),
});

export const NewspaperArticlesSchema = z.array(NewspaperArticleSchema);
export type NewspaperArticle = z.infer<typeof NewspaperArticleSchema>;

export function parseNewspaperArticles(raw: string | null | undefined): NewspaperArticle[] | null {
  return safeParse(NewspaperArticlesSchema, raw);
}

// ── 4. otherLinksJson — OtherLink[] ──────────────────────────────────────────

export const OtherLinkSchema = z.object({
  label: z.string(),
  url: z.string(),
  type: z.string().optional(),
});

export const OtherLinksSchema = z.array(OtherLinkSchema);
export type OtherLink = z.infer<typeof OtherLinkSchema>;

export function parseOtherLinks(raw: string | null | undefined): OtherLink[] | null {
  return safeParse(OtherLinksSchema, raw);
}

// ── 5. platformEnrichmentStatus ───────────────────────────────────────────────

const PlatformStatusEntrySchema = z.object({
  channelId: z.string().optional(),
  channelUrl: z.string().optional(),
  subscriberCount: z.number().optional(),
  talkUrl: z.string().optional(),
  viewCount: z.number().optional(),
  url: z.string().optional(),
  enrichedAt: z.string().optional(),
}).passthrough();

export const PlatformEnrichmentStatusSchema = z.record(z.string(), PlatformStatusEntrySchema);
export type PlatformEnrichmentStatus = z.infer<typeof PlatformEnrichmentStatusSchema>;

export function parsePlatformEnrichmentStatus(raw: string | null | undefined): PlatformEnrichmentStatus | null {
  return safeParse(PlatformEnrichmentStatusSchema, raw);
}

// ── 6. websitesJson — AuthorWebsite[] ─────────────────────────────────────────

export const AuthorWebsiteSchema = z.object({
  label: z.string(),
  url: z.string(),
  type: z.enum(["personal", "company", "speaking", "podcast", "course", "blog", "newsletter", "ted", "masterclass", "other"]),
});

export const WebsitesSchema = z.array(AuthorWebsiteSchema);
export type AuthorWebsite = z.infer<typeof AuthorWebsiteSchema>;

export function parseWebsites(raw: string | null | undefined): AuthorWebsite[] | null {
  return safeParse(WebsitesSchema, raw);
}

// ── 7. professionalEntriesJson — ProfessionalEntry[] ─────────────────────────

export const ProfessionalEntrySchema = z.object({
  title: z.string(),
  org: z.string(),
  period: z.string(),
  description: z.string(),
  url: z.string().optional(),
});

export const ProfessionalEntriesSchema = z.array(ProfessionalEntrySchema);
export type ProfessionalEntry = z.infer<typeof ProfessionalEntrySchema>;

export function parseProfessionalEntries(raw: string | null | undefined): ProfessionalEntry[] | null {
  return safeParse(ProfessionalEntriesSchema, raw);
}

// ── 8. richBioJson — RichBioResult ───────────────────────────────────────────

export const RichBioSchema = z.object({
  fullBio: z.string(),
  professionalSummary: z.string(),
  personalNote: z.string().optional(),
  professionalEntries: z.array(ProfessionalEntrySchema),
  enrichedAt: z.string(),
  model: z.string(),
});

export type RichBio = z.infer<typeof RichBioSchema>;

export function parseRichBio(raw: string | null | undefined): RichBio | null {
  return safeParse(RichBioSchema, raw);
}

// ── 9. tagsJson — string[] ────────────────────────────────────────────────────

export const TagsSchema = z.array(z.string());

export function parseTags(raw: string | null | undefined): string[] | null {
  return safeParse(TagsSchema, raw);
}

// ── 10. mediaPresenceJson — MediaPresence ─────────────────────────────────────

const MediaPlatformEntrySchema = z.object({
  channelId: z.string().optional(),
  channelUrl: z.string().optional(),
  subscriberCount: z.number().optional(),
  videoCount: z.number().optional(),
  totalViews: z.number().optional(),
  profileUrl: z.string().optional(),
  talkCount: z.number().optional(),
  latestTalkUrl: z.string().optional(),
  latestTalkTitle: z.string().optional(),
  url: z.string().optional(),
  subscriberEstimate: z.string().optional(),
  postCount: z.number().optional(),
  showUrl: z.string().optional(),
  episodeCount: z.number().optional(),
  platform: z.string().optional(),
  courseUrl: z.string().optional(),
  courseTitle: z.string().optional(),
  fetchedAt: z.string().optional(),
}).passthrough();

export const MediaPresenceSchema = z.object({
  youtube: MediaPlatformEntrySchema.optional(),
  ted: MediaPlatformEntrySchema.optional(),
  substack: MediaPlatformEntrySchema.optional(),
  podcast: MediaPlatformEntrySchema.optional(),
  masterclass: MediaPlatformEntrySchema.optional(),
  enrichedAt: z.string().optional(),
}).passthrough();

export type MediaPresence = z.infer<typeof MediaPresenceSchema>;

export function parseMediaPresence(raw: string | null | undefined): MediaPresence | null {
  return safeParse(MediaPresenceSchema, raw);
}

// ── 11. businessProfileJson — BusinessProfile ────────────────────────────────

export const BusinessProfileSchema = z.object({
  company: z.object({
    name: z.string(),
    role: z.string(),
    url: z.string().nullable().optional(),
    description: z.string().nullable().optional(),
  }).optional(),
  speakingTopics: z.array(z.string()).optional(),
  speakingFee: z.object({
    range: z.string(),
    currency: z.string(),
  }).optional(),
  awards: z.array(z.object({
    name: z.string(),
    year: z.number().nullable().optional(),
    org: z.string().nullable().optional(),
  })).optional(),
  education: z.array(z.object({
    degree: z.string(),
    institution: z.string(),
    year: z.number().nullable().optional(),
  })).optional(),
  boardMemberships: z.array(z.object({
    org: z.string(),
    role: z.string(),
    url: z.string().nullable().optional(),
  })).optional(),
  enrichedAt: z.string().optional(),
}).passthrough();

export type BusinessProfile = z.infer<typeof BusinessProfileSchema>;

export function parseBusinessProfile(raw: string | null | undefined): BusinessProfile | null {
  return safeParse(BusinessProfileSchema, raw);
}

// ── 12. academicResearchJson — AcademicEnrichmentResult ──────────────────────

const AcademicAuthorProfileSchema = z.object({
  source: z.enum(["openalex", "semantic_scholar"]),
  authorId: z.string(),
  name: z.string(),
  affiliations: z.array(z.string()),
  hIndex: z.number(),
  i10Index: z.number(),
  citationCount: z.number(),
  worksCount: z.number(),
  orcid: z.string().nullable(),
});

const AcademicPaperSchema = z.object({
  source: z.enum(["openalex", "semantic_scholar"]),
  paperId: z.string(),
  title: z.string(),
  year: z.number().nullable(),
  citationCount: z.number(),
  doi: z.string().nullable(),
  isOpenAccess: z.boolean(),
  pdfUrl: z.string().nullable(),
  journal: z.string().nullable(),
  type: z.string().nullable(),
  authors: z.array(z.string()),
});

export const AcademicResearchSchema = z.object({
  authorProfile: AcademicAuthorProfileSchema.nullable(),
  topPapers: z.array(AcademicPaperSchema),
  bookRelatedPapers: z.array(AcademicPaperSchema),
  fetchedAt: z.string(),
  error: z.string().optional(),
});

export type AcademicResearch = z.infer<typeof AcademicResearchSchema>;

export function parseAcademicResearch(raw: string | null | undefined): AcademicResearch | null {
  return safeParse(AcademicResearchSchema, raw);
}

// ── 13. webTrafficJson — SimilarwebTrafficResult ─────────────────────────────

export const WebTrafficSchema = z.object({
  domain: z.string().optional(),
  monthlyVisits: z.number().optional(),
  globalRank: z.number().nullable().optional(),
  countryRank: z.number().nullable().optional(),
  bounceRate: z.number().nullable().optional(),
  avgVisitDuration: z.number().nullable().optional(),
  pagesPerVisit: z.number().nullable().optional(),
  trafficSources: z.object({
    direct: z.number().optional(),
    search: z.number().optional(),
    social: z.number().optional(),
    email: z.number().optional(),
    referrals: z.number().optional(),
    paid: z.number().optional(),
  }).optional(),
  fetchedAt: z.string().optional(),
}).passthrough();

export type WebTraffic = z.infer<typeof WebTrafficSchema>;

export function parseWebTraffic(raw: string | null | undefined): WebTraffic | null {
  return safeParse(WebTrafficSchema, raw);
}

// ── 14. earningsCallMentionsJson — EnterpriseImpactResult ────────────────────

const FilingMentionSchema = z.object({
  source: z.enum(["sec_edgar", "quartr"]),
  filingType: z.string(),
  companyName: z.string(),
  ticker: z.string().nullable(),
  filingDate: z.string(),
  title: z.string(),
  url: z.string(),
  excerpt: z.string().nullable(),
});

const EarningsCallMentionSchema = z.object({
  source: z.enum(["quartr", "sec_edgar"]),
  companyName: z.string(),
  ticker: z.string().nullable(),
  eventDate: z.string(),
  eventType: z.string(),
  title: z.string(),
  url: z.string(),
  mentionContext: z.string().nullable(),
});

const CorporateAdvisoryRoleSchema = z.object({
  companyName: z.string(),
  role: z.string(),
  startDate: z.string().nullable(),
  endDate: z.string().nullable(),
  source: z.string(),
  url: z.string().nullable(),
});

export const EnterpriseImpactSchema = z.object({
  filingMentions: z.array(FilingMentionSchema),
  earningsCallMentions: z.array(EarningsCallMentionSchema),
  advisoryRoles: z.array(CorporateAdvisoryRoleSchema),
  totalMentions: z.number(),
  uniqueCompanies: z.array(z.string()),
  impactScore: z.enum(["high", "medium", "low", "none"]),
  fetchedAt: z.string(),
  error: z.string().optional(),
});

export type EnterpriseImpact = z.infer<typeof EnterpriseImpactSchema>;

export function parseEnterpriseImpact(raw: string | null | undefined): EnterpriseImpact | null {
  return safeParse(EnterpriseImpactSchema, raw);
}

// ── 15. professionalProfileJson — ProfessionalProfileResult ──────────────────

const ProfessionalRoleSchema = z.object({
  title: z.string(),
  organization: z.string(),
  period: z.string().nullable(),
  isCurrent: z.boolean(),
  source: z.string(),
});

const BoardSeatSchema = z.object({
  organization: z.string(),
  role: z.string(),
  startYear: z.number().nullable(),
  endYear: z.number().nullable(),
  source: z.string(),
  url: z.string().nullable(),
});

const EducationEntrySchema = z.object({
  institution: z.string(),
  degree: z.string(),
  field: z.string().nullable(),
  year: z.number().nullable(),
});

const AwardEntrySchema = z.object({
  name: z.string(),
  organization: z.string().nullable(),
  year: z.number().nullable(),
  description: z.string().nullable(),
});

const CompanyAffiliationSchema = z.object({
  name: z.string(),
  role: z.string(),
  type: z.enum(["founded", "employed", "advisor", "investor", "board"]),
  url: z.string().nullable(),
  description: z.string().nullable(),
});

export const ProfessionalProfileSchema = z.object({
  currentRole: ProfessionalRoleSchema.nullable(),
  roles: z.array(ProfessionalRoleSchema),
  boardSeats: z.array(BoardSeatSchema),
  education: z.array(EducationEntrySchema),
  awards: z.array(AwardEntrySchema),
  companyAffiliations: z.array(CompanyAffiliationSchema),
  linkedinUrl: z.string().nullable(),
  totalExperience: z.number().nullable(),
  fetchedAt: z.string(),
  source: z.enum(["perplexity", "apollo", "wikipedia", "combined"]),
  error: z.string().optional(),
});

export type ProfessionalProfile = z.infer<typeof ProfessionalProfileSchema>;

export function parseProfessionalProfile(raw: string | null | undefined): ProfessionalProfile | null {
  return safeParse(ProfessionalProfileSchema, raw);
}

// ── 16. documentArchiveJson — DocumentArchive ────────────────────────────────

const DriveDocumentSchema = z.object({
  fileId: z.string(),
  name: z.string(),
  mimeType: z.string(),
  size: z.number().nullable(),
  webViewLink: z.string(),
  webContentLink: z.string().nullable(),
  createdTime: z.string(),
  modifiedTime: z.string(),
  parentFolderId: z.string(),
});

export const DocumentArchiveSchema = z.object({
  authorName: z.string(),
  folderId: z.string(),
  folderUrl: z.string(),
  documents: z.array(DriveDocumentSchema),
  totalSize: z.number(),
  documentCount: z.number(),
  lastUpdated: z.string(),
});

export type DocumentArchive = z.infer<typeof DocumentArchiveSchema>;

export function parseDocumentArchive(raw: string | null | undefined): DocumentArchive | null {
  return safeParse(DocumentArchiveSchema, raw);
}

// ── 17. geographyJson — GeographyProfile ─────────────────────────────────────

export const GeographySchema = z.object({
  birthCity: z.string().optional(),
  birthCountry: z.string().optional(),
  childhoodCity: z.string().optional(),
  formativeCities: z.array(z.string()).optional(),
  currentBase: z.string().optional(),
  countriesLived: z.array(z.string()).optional(),
  culturalRegions: z.array(z.string()).optional(),
  geographyNarrative: z.string().optional(),
}).passthrough();

export type GeographyProfile = z.infer<typeof GeographySchema>;

export function parseGeography(raw: string | null | undefined): GeographyProfile | null {
  return safeParse(GeographySchema, raw);
}

// ── 18. historicalContextJson — HistoricalContext ─────────────────────────────

export const HistoricalContextSchema = z.object({
  birthDecade: z.string().optional(),
  formativeYears: z.object({ from: z.number(), to: z.number() }).optional(),
  majorWorldEvents: z.array(z.object({
    year: z.number(),
    event: z.string(),
    relevance: z.string(),
  })).optional(),
  culturalEra: z.string().optional(),
  eraNarrative: z.string().optional(),
}).passthrough();

export type HistoricalContext = z.infer<typeof HistoricalContextSchema>;

export function parseHistoricalContext(raw: string | null | undefined): HistoricalContext | null {
  return safeParse(HistoricalContextSchema, raw);
}

// ── 19. familyJson — FamilyProfile ───────────────────────────────────────────

export const FamilySchema = z.object({
  parents: z.array(z.object({
    name: z.string().optional(),
    profession: z.string().optional(),
    nationality: z.string().optional(),
    notes: z.string().optional(),
  })).optional(),
  siblings: z.object({
    count: z.number(),
    birthOrder: z.string(),
    notes: z.string(),
  }).optional(),
  spouse: z.object({
    name: z.string().optional(),
    profession: z.string().optional(),
    duration: z.string().optional(),
    notes: z.string().optional(),
  }).optional(),
  children: z.object({
    count: z.number(),
    notes: z.string(),
  }).optional(),
  familyCulture: z.object({
    religion: z.string().optional(),
    politicalLeanings: z.string().optional(),
    socioeconomicClass: z.string().optional(),
    immigrationBackground: z.string().optional(),
    notes: z.string().optional(),
  }).optional(),
}).passthrough();

export type FamilyProfile = z.infer<typeof FamilySchema>;

export function parseFamily(raw: string | null | undefined): FamilyProfile | null {
  return safeParse(FamilySchema, raw);
}

// ── 20. associationsJson — Associations ──────────────────────────────────────

export const AssociationsSchema = z.object({
  mentors: z.array(z.object({
    name: z.string(),
    relationship: z.string().optional(),
    contribution: z.string().optional(),
  })).optional(),
  proteges: z.array(z.object({
    name: z.string(),
    notes: z.string().optional(),
  })).optional(),
  collaborators: z.array(z.object({
    name: z.string(),
    type: z.enum(["co-author", "co-presenter", "business"]).optional(),
    notes: z.string().optional(),
  })).optional(),
  intellectualRivals: z.array(z.object({
    name: z.string(),
    disagreement: z.string().optional(),
  })).optional(),
  organizations: z.array(z.object({
    name: z.string(),
    role: z.string().optional(),
    type: z.enum(["think-tank", "board", "conference", "association"]).optional(),
    url: z.string().optional(),
  })).optional(),
  universities: z.array(z.object({
    name: z.string(),
    degree: z.string().optional(),
    year: z.number().optional(),
    role: z.enum(["student", "faculty", "honorary"]).optional(),
  })).optional(),
  schoolsOfThought: z.array(z.string()).optional(),
  citedInfluences: z.array(z.object({
    name: z.string(),
    type: z.enum(["author", "thinker", "book"]).optional(),
    notes: z.string().optional(),
  })).optional(),
  intellectualDescendants: z.array(z.object({
    name: z.string(),
    notes: z.string().optional(),
  })).optional(),
  signatureFrameworks: z.array(z.object({
    name: z.string(),
    description: z.string().optional(),
    year: z.number().optional(),
  })).optional(),
}).passthrough();

export type Associations = z.infer<typeof AssociationsSchema>;

export function parseAssociations(raw: string | null | undefined): Associations | null {
  return safeParse(AssociationsSchema, raw);
}

// ── 21. formativeExperiencesJson — FormativeExperience[] ─────────────────────

export const FormativeExperienceSchema = z.object({
  type: z.enum(["trauma", "epiphany", "career", "travel", "loss", "other"]),
  description: z.string(),
  approximateYear: z.number().optional(),
  source: z.string(),
});

export const FormativeExperiencesSchema = z.array(FormativeExperienceSchema);
export type FormativeExperience = z.infer<typeof FormativeExperienceSchema>;

export function parseFormativeExperiences(raw: string | null | undefined): FormativeExperience[] | null {
  return safeParse(FormativeExperiencesSchema, raw);
}

// ── 22. authorBioSourcesJson — raw source responses ──────────────────────────

export const AuthorBioSourcesSchema = z.record(z.string(), z.unknown());
export type AuthorBioSources = z.infer<typeof AuthorBioSourcesSchema>;

export function parseAuthorBioSources(raw: string | null | undefined): AuthorBioSources | null {
  return safeParse(AuthorBioSourcesSchema, raw);
}

// ── 23. newsCacheJson — NewsArticle[] ─────────────────────────────────────────

export const NewsArticleSchema = z.object({
  title: z.string(),
  url: z.string(),
  source: z.string(),
  publishedAt: z.string().nullable().optional(),
  snippet: z.string().nullable().optional(),
});

export const NewsArticlesSchema = z.array(NewsArticleSchema);
export type NewsArticle = z.infer<typeof NewsArticleSchema>;

export function parseNewsCache(raw: string | null | undefined): NewsArticle[] | null {
  return safeParse(NewsArticlesSchema, raw);
}

// ── 24. cnbcMentionsCacheJson — same shape as newsCacheJson ──────────────────

export function parseCnbcMentionsCache(raw: string | null | undefined): NewsArticle[] | null {
  return safeParse(NewsArticlesSchema, raw);
}

// ── 25. conversationGroups — string[] ────────────────────────────────────────

export const ConversationGroupsSchema = z.array(z.string());

export function parseConversationGroups(raw: string | null | undefined): string[] | null {
  return safeParse(ConversationGroupsSchema, raw);
}
