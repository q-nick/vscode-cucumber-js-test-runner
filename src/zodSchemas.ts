import { z } from 'zod';

const LocationSchema = z
  .object({
    line: z.number(),
    column: z.number().optional(),
  })
  .strict();

const TagSchema = z
  .object({
    name: z.string(),
    location: LocationSchema.optional(),
    id: z.string(),
  })
  .strict();

export type Tag = z.infer<typeof TagSchema>;

const TableCellSchema = z
  .object({
    value: z.string(),
    location: LocationSchema,
  })
  .strict();

const TableRowSchema = z
  .object({
    id: z.string(),
    cells: z.array(TableCellSchema),
    location: LocationSchema,
  })
  .strict();

const DataTableSchema = z
  .object({
    rows: z.array(TableRowSchema),
    location: LocationSchema,
  })
  .strict();

const StepSchema = z
  .object({
    id: z.string(),
    keyword: z.string(),
    keywordType: z.string(),
    text: z.string(),
    location: LocationSchema,
    dataTable: DataTableSchema.optional(),
  })
  .strict();

export type Step = z.infer<typeof StepSchema>;

const ExampleSchema = z
  .object({
    id: z.string(),
    tags: z.array(TagSchema),
    location: LocationSchema,
    keyword: z.string(),
    name: z.string(),
    description: z.string(),
    tableHeader: TableRowSchema,
    tableBody: z.array(TableRowSchema),
  })
  .strict();

const ScenarioSchema = z
  .object({
    id: z.string(),
    keyword: z.string(),
    name: z.string(),
    description: z.string(),
    location: LocationSchema,
    tags: z.array(TagSchema).optional(),
    steps: z.array(StepSchema),
    examples: z.array(ExampleSchema).optional(),
  })
  .strict();

export type Scenario = z.infer<typeof ScenarioSchema>;

const BackgroundSchema = z
  .object({
    id: z.string(),
    location: LocationSchema,
    keyword: z.string(),
    name: z.string(),
    description: z.string(),
    steps: z.array(StepSchema),
  })
  .strict();

export type Background = z.infer<typeof BackgroundSchema>;

const FeatureChildSchema = z
  .object({
    scenario: ScenarioSchema.optional(),
    background: BackgroundSchema.optional(),
    rule: z.any().optional(),
  })
  .strict();

const FeatureSchema = z
  .object({
    name: z.string(),
    description: z.string().optional(),
    tags: z.array(TagSchema).optional(),
    children: z.array(FeatureChildSchema),
    location: LocationSchema.optional(),
    language: z.string().optional(),
    keyword: z.string().optional(),
  })
  .strict();

export type Feature = z.infer<typeof FeatureSchema>;

export const GherkinDocumentSchema = z
  .object({
    uri: z.string(),
    feature: FeatureSchema.optional(),
    comments: z.array(z.any()).optional(),
  })
  .strict();
export type GherkinDocument = z.infer<typeof GherkinDocumentSchema>;

const TimestampSchema = z
  .object({
    seconds: z.number(),
    nanos: z.number(),
  })
  .strict();

export const TestRunStartedSchema = z
  .object({
    timestamp: TimestampSchema,
  })
  .strict();
export type TestRunStarted = z.infer<typeof TestRunStartedSchema>;

const DurationSchema = z
  .object({
    seconds: z.number(),
    nanos: z.number(),
  })
  .strict();

const TestResultSchema = z
  .object({
    status: z.enum(['UNKNOWN', 'PASSED', 'SKIPPED', 'PENDING', 'UNDEFINED', 'AMBIGUOUS', 'FAILED']),
    message: z.string().optional(),
    duration: DurationSchema,
  })
  .strict();

export type TestStepStatus = z.infer<typeof TestResultSchema.shape.status>;

export const TestRunFinishedSchema = z
  .object({
    success: z.boolean(),
    timestamp: TimestampSchema,
  })
  .strict();
export type TestRunFinished = z.infer<typeof TestRunFinishedSchema>;

export const TestCaseStartedSchema = z
  .object({
    timestamp: TimestampSchema,
    attempt: z.number(),
    testCaseId: z.string(),
    id: z.string(),
    workerId: z.string().optional(),
  })
  .strict();
export type TestCaseStarted = z.infer<typeof TestCaseStartedSchema>;

export const TestCaseFinishedSchema = z
  .object({
    testCaseStartedId: z.string(),
    willBeRetried: z.boolean().optional(),
    timestamp: TimestampSchema,
  })
  .strict();
export type TestCaseFinished = z.infer<typeof TestCaseFinishedSchema>;

const StepMatchArgumentSchema = z
  .object({
    parameterTypeName: z.string(),
    value: z.string().optional(),
    start: z.number().optional(),
    group: z
      .object({
        start: z.number(),
        value: z.string(),
        children: z.array(z.any()),
      })
      .optional(),
  })
  .strict();

const StepMatchArgumentsListSchema = z
  .object({
    stepMatchArguments: z.array(StepMatchArgumentSchema),
  })
  .strict();

const TestStepResultSchema = z
  .object({
    duration: z
      .object({
        seconds: z.number(),
        nanos: z.number(),
      })
      .optional(),
    status: z.string().optional(),
  })
  .strict();

const TestStepFinishedSchema = z
  .object({
    testCaseStartedId: z.string(),
    testStepId: z.string(),
    testStepResult: TestResultSchema,
    timestamp: TimestampSchema,
  })
  .strict();
export type TestStepFinished = z.infer<typeof TestStepFinishedSchema>;

const TestStepStartedSchema = z
  .object({
    testCaseStartedId: z.string(),
    testStepId: z.string(),
    timestamp: TimestampSchema,
    stepMatchArgumentsLists: z.array(StepMatchArgumentsListSchema).optional(),
  })
  .strict();
export type TestStepStarted = z.infer<typeof TestStepStartedSchema>;

const PickleTagSchema = z
  .object({
    name: z.string(),
    astNodeId: z.string(),
  })
  .strict();

const PickleStepArgumentSchema = z
  .object({
    docString: z
      .object({
        content: z.string(),
      })
      .optional(),
    dataTable: z
      .object({
        rows: z.array(
          z
            .object({
              cells: z.array(
                z
                  .object({
                    value: z.string(),
                  })
                  .strict()
              ),
            })
            .strict()
        ),
      })
      .strict()
      .optional(),
  })
  .strict();

const PickleStepSchema = z
  .object({
    id: z.string(),
    text: z.string(),
    type: z.string(),
    astNodeIds: z.array(z.string()),
    argument: PickleStepArgumentSchema.optional(),
  })
  .strict();

export const PickleSchema = z
  .object({
    id: z.string(),
    uri: z.string(),
    name: z.string(),
    language: z.string(),
    steps: z.array(PickleStepSchema),
    tags: z.array(PickleTagSchema),
    astNodeIds: z.array(z.string()),
  })
  .strict();
export type Pickle = z.infer<typeof PickleSchema>;

export const TestCaseStepSchema = z
  .object({
    id: z.string(),
    pickleStepId: z.string().optional(),
    stepDefinitionIds: z.array(z.string()).optional(),
    stepMatchArgumentsLists: z.array(StepMatchArgumentsListSchema).optional(),
    hookId: z.string().optional(),
  })
  .strict();

export const TestCaseSchema = z
  .object({
    id: z.string(),
    pickleId: z.string(),
    testSteps: z.array(TestCaseStepSchema),
  })
  .strict();
export type TestCase = z.infer<typeof TestCaseSchema>;

export const AttachmentSchema = z
  .object({
    body: z.string(),
    mediaType: z.string(),
    contentEncoding: z.string().optional(),
    fileName: z.string().optional(),
    testCaseId: z.string(),
    testStepId: z.string().optional(),
    hookId: z.string().optional(),
  })
  .strict();
export type Attachment = z.infer<typeof AttachmentSchema>;

const StdoutDataSchema = z.string();

export type CucumberEvent =
  | { type: 'gherkinDocument'; data: GherkinDocument }
  | { type: 'testStepStarted'; data: TestStepStarted }
  | { type: 'testStepFinished'; data: TestStepFinished }
  | { type: 'stdout'; data: string }
  | { type: 'testRunStarted'; data: TestRunStarted }
  | { type: 'testRunFinished'; data: TestRunFinished }
  | { type: 'testCaseStarted'; data: TestCaseStarted }
  | { type: 'testCaseFinished'; data: TestCaseFinished }
  | { type: 'pickle'; data: Pickle }
  | { type: 'testCase'; data: TestCase }
  | { type: 'attachment'; data: Attachment };

function parseWithZodCatch<T>(schema: z.ZodType<T>, value: unknown, typeName: string): T | null {
  try {
    return schema.parse(value);
  } catch (err) {
    if (err instanceof z.ZodError) {
      console.error(`[ZOD ERROR] ${typeName}`, {
        received: value,
        expected: typeName,
        issues: err.issues,
      });
    } else {
      console.error(`[UNKNOWN ERROR] ${typeName}`, err);
    }
    return null;
  }
}

export function parseCucumberEvent(event: object | unknown[] | undefined): CucumberEvent | null {
  if (typeof event !== 'object' || event === null || Array.isArray(event)) {
    console.log('[INVALID]', event);
    return null;
  }

  let result: CucumberEvent | null = null;

  if ('gherkinDocument' in event) {
    const data = parseWithZodCatch(
      GherkinDocumentSchema,
      event.gherkinDocument,
      'GherkinDocumentSchema'
    );
    if (data) {
      result = { type: 'gherkinDocument', data };
    }
  } else if ('testStepStarted' in event) {
    const data = parseWithZodCatch(
      TestStepStartedSchema,
      event.testStepStarted,
      'TestStepStartedSchema'
    );
    if (data) {
      result = { type: 'testStepStarted', data };
    }
  } else if ('testStepFinished' in event) {
    const data = parseWithZodCatch(
      TestStepFinishedSchema,
      event.testStepFinished,
      'TestStepFinishedSchema'
    );
    if (data) {
      result = { type: 'testStepFinished', data };
    }
  } else if ('stdout' in event) {
    const data = parseWithZodCatch(StdoutDataSchema, event.stdout, 'StdoutDataSchema');
    if (data) {
      result = { type: 'stdout', data };
    }
  } else if ('testRunStarted' in event) {
    const data = parseWithZodCatch(
      TestRunStartedSchema,
      event.testRunStarted,
      'TestRunStartedSchema'
    );
    if (data) {
      result = { type: 'testRunStarted', data };
    }
  } else if ('testRunFinished' in event) {
    const data = parseWithZodCatch(
      TestRunFinishedSchema,
      event.testRunFinished,
      'TestRunFinishedSchema'
    );
    if (data) {
      result = { type: 'testRunFinished', data };
    }
  } else if ('testCaseStarted' in event) {
    const data = parseWithZodCatch(
      TestCaseStartedSchema,
      event.testCaseStarted,
      'TestCaseStartedSchema'
    );
    if (data) {
      result = { type: 'testCaseStarted', data };
    }
  } else if ('testCaseFinished' in event) {
    const data = parseWithZodCatch(
      TestCaseFinishedSchema,
      event.testCaseFinished,
      'TestCaseFinishedSchema'
    );
    if (data) {
      result = { type: 'testCaseFinished', data };
    }
  } else if ('pickle' in event) {
    const data = parseWithZodCatch(PickleSchema, event.pickle, 'PickleSchema');
    if (data) {
      result = { type: 'pickle', data };
    }
  } else if ('testCase' in event) {
    const data = parseWithZodCatch(TestCaseSchema, event.testCase, 'TestCaseSchema');
    if (data) {
      result = { type: 'testCase', data };
    }
  } else if ('attachment' in event) {
    const data = parseWithZodCatch(AttachmentSchema, event.attachment, 'AttachmentSchema');
    if (data) {
      result = { type: 'attachment', data };
    }
  }

  return result;
}
