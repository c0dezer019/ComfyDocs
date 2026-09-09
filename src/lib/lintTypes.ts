/**
 * ComfyDocs Linting Engine - Core Type Definitions
 *
 * This module defines the type system for the rule-based educational linting engine.
 * It provides abstractions for workflow AST representation, lint rules, diagnostics,
 * and educational content integration.
 */

// ============================================================================
// WORKFLOW AST TYPES
// ============================================================================

/**
 * Categorizes ComfyUI nodes into logical groups for rule targeting.
 */
export type NodeCategory =
  | 'sampling'
  | 'model'
  | 'vae'
  | 'conditioning'
  | 'latent'
  | 'image'
  | 'control'
  | 'utility'
  | 'unknown';

/**
 * Represents a connection point on a node (input or output slot).
 */
export interface NodeConnection {
  /** Slot name (e.g., 'model', 'positive', 'latent_image') */
  name: string;
  /** Connection type (e.g., 'MODEL', 'CLIP', 'VAE', 'CONDITIONING', 'LATENT') */
  type: string;
  /** Link ID if connected */
  linkId?: number;
  /** ID of the connected node */
  connectedNodeId?: number;
  /** Slot index on the connected node */
  connectedSlot?: number;
}

/**
 * Represents a widget value on a node (user-configurable parameter).
 */
export interface WidgetValue {
  /** Position in widgets_values array */
  index: number;
  /** Widget name if known (often inferred from position) */
  name?: string;
  /** The actual value */
  value: string | number | boolean | null;
  /** Inferred type of the value */
  type: 'string' | 'number' | 'boolean' | 'combo' | 'unknown';
}

/**
 * Internal representation of a ComfyUI node for linting purposes.
 * Normalized from raw workflow JSON for consistent rule evaluation.
 */
export interface WorkflowNode {
  /** Unique node identifier */
  id: number;
  /** Node class type (e.g., 'KSampler', 'CheckpointLoaderSimple') */
  type: string;
  /** User-assigned title (optional) */
  title?: string;
  /** Categorized node type for rule filtering */
  category: NodeCategory;
  /** Input connections */
  inputs: NodeConnection[];
  /** Output connections */
  outputs: NodeConnection[];
  /** Widget/parameter values */
  widgets: WidgetValue[];
  /** Position in the graph [x, y] */
  position: [number, number];
  /** Size of the node [width, height] */
  size: [number, number];
  /** Reference to raw node data for edge cases */
  _raw: unknown;
}

/**
 * Represents a connection between two nodes in the workflow.
 */
export interface WorkflowLink {
  /** Unique link identifier */
  id: number;
  /** Source node ID */
  sourceNodeId: number;
  /** Source output slot index */
  sourceSlot: number;
  /** Target node ID */
  targetNodeId: number;
  /** Target input slot index */
  targetSlot: number;
  /** Connection type (e.g., 'MODEL', 'CONDITIONING') */
  type: string;
}

/**
 * Normalized workflow AST for rule evaluation.
 * Pre-computed graph relationships for O(1) lookups.
 */
export interface WorkflowAST {
  /** All nodes indexed by ID */
  nodes: Map<number, WorkflowNode>;
  /** All links indexed by ID */
  links: Map<number, WorkflowLink>;
  /** Adjacency list: nodeId -> downstream nodeIds (nodes this feeds into) */
  downstream: Map<number, Set<number>>;
  /** Adjacency list: nodeId -> upstream nodeIds (nodes that feed into this) */
  upstream: Map<number, Set<number>>;
  /** Nodes indexed by type string for fast type queries */
  byType: Map<string, Set<number>>;
  /** Nodes indexed by category for rule targeting */
  byCategory: Map<NodeCategory, Set<number>>;
  /** Raw workflow JSON for fallback access */
  _raw: unknown;
}

// ============================================================================
// EXTRACTED PARAMETERS
// ============================================================================

/**
 * Parameters extracted from the workflow for rule context.
 * These are the common generation parameters users care about.
 */
export interface ExtractedParameters {
  /** Generation seed */
  seed?: string;
  /** Number of sampling steps */
  steps?: number;
  /** CFG/guidance scale */
  cfg?: number;
  /** Sampler algorithm name */
  sampler?: string;
  /** Scheduler type */
  scheduler?: string;
  /** Denoise strength (for img2img) */
  denoise?: number;
  /** Checkpoint/model filename */
  modelName?: string;
  /** VAE filename */
  vaeName?: string;
  /** Image dimensions if detectable */
  width?: number;
  height?: number;
}

// ============================================================================
// LINT RULE SYSTEM
// ============================================================================

/**
 * Severity levels for lint diagnostics.
 * - error: Critical issue that will likely cause generation failure or severe artifacts
 * - warning: Issue that may cause quality degradation or suboptimal results
 * - info: Suggestion or educational note that doesn't indicate a problem
 */
export type RuleSeverity = 'info' | 'warning' | 'error';

/**
 * Categories for grouping related rules.
 */
export type RuleCategory =
  | 'workflow'
  | 'sampling'
  | 'model'
  | 'vae'
  | 'performance'
  | 'prompt'
  | 'compatibility';

/**
 * Types of automated fixes that can be suggested.
 */
export type FixAction =
  | 'change_parameter'
  | 'add_node'
  | 'remove_node'
  | 'change_connection'
  | 'modify_prompt'
  | 'external_tool'
  | 'refactor';

/**
 * Confidence level for suggested fixes.
 */
export type FixConfidence = 'high' | 'medium' | 'low';

/**
 * Context passed to each rule during evaluation.
 * Provides access to the full AST and helper methods for common operations.
 */
export interface LintContext {
  /** The workflow AST being analyzed */
  ast: WorkflowAST;

  /** Extracted prompt text grouped by polarity */
  prompts: {
    positive: string[];
    negative: string[];
  };

  /** Extracted generation parameters */
  parameters: ExtractedParameters;

  /**
   * Resolve upstream nodes through Reroute chains.
   * @param nodeId - Starting node ID
   * @param inputName - Name of the input slot to trace
   * @returns The functional source node (skipping Reroutes), or null if not connected
   */
  resolveUpstream: (nodeId: number, inputName: string) => WorkflowNode | null;

  /**
   * Find all nodes matching a type pattern.
   * @param pattern - Regex pattern to match against node types
   * @returns Array of matching nodes
   */
  findNodesByType: (pattern: RegExp) => WorkflowNode[];

  /**
   * Check if a data path exists between two nodes.
   * @param fromId - Source node ID
   * @param toId - Destination node ID
   * @returns True if data flows from source to destination
   */
  pathExists: (fromId: number, toId: number) => boolean;

  /**
   * Get all nodes in a specific category.
   * @param category - Node category to query
   * @returns Array of nodes in that category
   */
  getNodesByCategory: (category: NodeCategory) => WorkflowNode[];

  /**
   * Trace the model chain from a sampler to find the checkpoint.
   * Handles LoRA stacks and other model modifiers.
   * @param samplerId - ID of the sampler node
   * @returns The checkpoint loader node, or null if not found
   */
  traceModelSource: (samplerId: number) => WorkflowNode | null;
}

/**
 * Suggested fix for a diagnostic, with structured data for potential automation.
 */
export interface SuggestedFix {
  /** Type of action required */
  action: FixAction;
  /** Human-readable description of the fix */
  description: string;
  /** How confident we are this will resolve the issue */
  confidence: FixConfidence;
  /** For change_parameter: the new value to set */
  newValue?: unknown;
  /** For add_node: the node type to add */
  nodeType?: string;
  /** For change_connection: connection details */
  connection?: {
    fromNode: number;
    fromSlot: string;
    toNode: number;
    toSlot: string;
  };
}

/**
 * Educational context embedded in a diagnostic.
 * Provides the "why" behind the lint rule.
 */
export interface EducationalContext {
  /** Brief explanation suitable for tooltip (1-2 sentences) */
  summary: string;
  /** Key for fetching/caching detailed AI-generated explanation */
  detailKey?: string;
  /** Links to relevant documentation */
  docUrls?: string[];
}

/**
 * Information about the specific parameter causing an issue.
 */
export interface OffendingParameter {
  /** Parameter/widget name */
  name: string;
  /** Current value */
  value: unknown;
  /** Expected type or format */
  expectedType?: string;
  /** Valid range if applicable */
  validRange?: {
    min?: number;
    max?: number;
  };
}

/**
 * Optional spatial annotation for image overlay.
 * Used when a diagnostic relates to a specific region of the generated image.
 */
export interface DiagnosticImageRegion {
  /** Bounding box [ymin, xmin, ymax, xmax] normalized to 0-1 */
  box_2d: [number, number, number, number];
  /** Rendering style */
  style: 'box' | 'paint';
}

/**
 * Result of a single rule evaluation against a node.
 * This is the core output of the linting process.
 */
export interface LintDiagnostic {
  /** Rule ID that generated this diagnostic (e.g., 'sampling/cfg-too-high') */
  ruleId: string;
  /** Human-readable rule name */
  ruleName: string;
  /** Diagnostic severity */
  severity: RuleSeverity;
  /** Rule category for grouping */
  category: RuleCategory;

  /** The specific node that triggered this diagnostic */
  nodeId: number;
  /** Node type for display */
  nodeType: string;

  /** What's wrong - the main diagnostic message */
  message: string;

  /** The specific parameter causing the issue (if applicable) */
  offendingParameter?: OffendingParameter;

  /** Suggested fix with confidence level */
  suggestedFix?: SuggestedFix;

  /** Educational content explaining why this matters */
  educationalContext: EducationalContext;

  /** Optional spatial annotation for image overlay */
  imageRegion?: DiagnosticImageRegion;

  /** Timestamp when diagnostic was generated */
  timestamp?: number;
}

/**
 * Interface for implementing linting rules.
 * Rules are the core building blocks of the linting engine.
 */
export interface LintRule {
  /** Unique identifier (e.g., 'sampling/cfg-too-high') */
  id: string;

  /** Human-readable name */
  name: string;

  /** Default severity (can be overridden by user config) */
  severity: RuleSeverity;

  /** Rule category for grouping and filtering */
  category: RuleCategory;

  /** Node types this rule applies to (empty array = all nodes) */
  appliesTo: string[];

  /** Why this rule matters - shown in UI when explaining the rule */
  rationale: string;

  /** Whether rule is enabled by default */
  defaultEnabled: boolean;

  /**
   * Check a single node against this rule.
   * @param node - The node to evaluate
   * @param context - Full workflow context for cross-node analysis
   * @returns Diagnostic if rule violated, null if passed
   */
  check(node: WorkflowNode, context: LintContext): LintDiagnostic | null;
}

/**
 * A rule that checks the workflow globally rather than per-node.
 */
export interface GlobalLintRule extends Omit<LintRule, 'check' | 'appliesTo'> {
  /** Mark as global rule */
  isGlobal: true;

  /**
   * Check the entire workflow.
   * @param context - Full workflow context
   * @returns Array of diagnostics (can be empty)
   */
  check(context: LintContext): LintDiagnostic[];
}

// ============================================================================
// LINT RESULTS
// ============================================================================

/**
 * Metadata about a lint run.
 */
export interface LintMetadata {
  /** Number of rules that were executed */
  rulesRun: number;
  /** Number of rules that were skipped (not applicable) */
  rulesSkipped: number;
  /** Total nodes analyzed */
  nodesAnalyzed: number;
  /** Execution time in milliseconds */
  executionTimeMs: number;
  /** Timestamp of the lint run */
  timestamp: number;
}

/**
 * Quick counts of diagnostics by severity.
 */
export interface DiagnosticCounts {
  errors: number;
  warnings: number;
  info: number;
  total: number;
}

/**
 * Complete result of linting a workflow.
 */
export interface LintResult {
  /** All diagnostics generated */
  diagnostics: LintDiagnostic[];
  /** Execution metadata */
  meta: LintMetadata;
  /** Quick severity counts */
  counts: DiagnosticCounts;
  /** Whether the lint completed successfully */
  success: boolean;
  /** Error message if lint failed */
  error?: string;
}

// ============================================================================
// LINT CONFIGURATION
// ============================================================================

/**
 * Threshold configuration for numeric rules.
 */
export interface LintThresholds {
  /** Maximum CFG before warning */
  maxCfg: number;
  /** Minimum steps before warning */
  minSteps: number;
  /** Maximum steps before info */
  maxSteps: number;
  /** Denoise threshold for high-denoise warning */
  warnOnHighDenoise: number;
  /** Maximum nodes before performance warning */
  maxNodes: number;
}

/**
 * Per-rule configuration override.
 */
export interface RuleOverride {
  /** Whether the rule is enabled */
  enabled?: boolean;
  /** Override severity */
  severity?: RuleSeverity;
}

/**
 * User/project configuration for the linter.
 */
export interface LintConfig {
  /** Rules to disable by ID */
  disabledRules: string[];
  /** Override severity for specific rules */
  severityOverrides: Record<string, RuleSeverity>;
  /** Per-rule configuration overrides */
  ruleOverrides?: Record<string, RuleOverride>;
  /** Numeric thresholds for various checks */
  thresholds: LintThresholds;
  /** Whether to include info-level diagnostics */
  includeInfo: boolean;
  /** Custom rule definitions (for extensibility) */
  customRules?: LintRule[];
}

// ============================================================================
// EDUCATIONAL CONTENT TYPES
// ============================================================================

/**
 * Categorized fix suggestion with step-by-step instructions.
 */
export interface EducationalFix {
  /** Priority order (lower = try first) */
  priority: number;
  /** Fix category tag matching common ComfyUI workflow patterns */
  category: 'prompt' | 'ksampler' | 'node' | 'inpaint' | 'external';
  /** One-line summary */
  title: string;
  /** Step-by-step instructions */
  steps: string[];
  /** Estimated effectiveness */
  confidence: FixConfidence;
  /** Specific parameter changes if applicable */
  parameterChanges?: Array<{
    nodeName: string;
    parameter: string;
    currentValue?: unknown;
    suggestedValue: unknown;
  }>;
}

/**
 * Structured educational content for a diagnostic.
 * This is the full "learn more" content, typically AI-generated.
 */
export interface EducationalContent {
  /** Unique key for caching */
  contentKey: string;
  /** The rule this explains */
  ruleId: string;
  /** Node type context */
  nodeType: string;

  /** Short summary (1-2 sentences) for inline display */
  summary: string;

  /** Detailed structured explanation */
  explanation: {
    /** What the issue is */
    issue: string;
    /** Why it matters technically */
    technicalContext: string;
    /** What visual artifacts it can cause */
    visualImpact: string;
    /** When this might be intentional */
    exceptions?: string;
  };

  /** Categorized fix suggestions with steps */
  fixes: EducationalFix[];

  /** Related learning resources */
  resources: Array<{
    title: string;
    url: string;
    type: 'docs' | 'video' | 'community';
  }>;

  /** Cache metadata */
  generatedAt: number;
  /** AI model used for generation */
  modelUsed: string;
}

/**
 * Request for educational content generation.
 */
export interface EducationRequest {
  /** The diagnostic to explain */
  diagnostic: LintDiagnostic;
  /** Workflow context for tailored explanations */
  workflowContext: {
    samplerType?: string;
    modelName?: string;
    steps?: number;
    cfg?: number;
  };
  /** Optional image for visual context */
  imageBase64?: string;
}

// ============================================================================
// INTEGRATION TYPES
// ============================================================================

/**
 * Extended QualityIssue that includes linting data.
 * Used for backward compatibility with existing UI components.
 */
export interface LintedQualityIssue {
  // Standard QualityIssue fields
  id: string;
  type: string;
  description: string;
  severity: 'Critical' | 'Major' | 'Minor' | 'Note';
  score: number;
  confidence?: number;
  passCount?: number;
  suggestedFixes?: string[];
  suggestedFix?: string;
  userNotes?: string;
  box_2d?: [number, number, number, number];
  style?: 'box' | 'paint';
  labelRotation?: number;

  // Linting-specific extensions
  /** Node ID in workflow graph */
  nodeId?: number;
  /** Node type for categorization */
  nodeType?: string;
  /** Rule that generated this issue */
  ruleId?: string;
  /** Educational context summary */
  educationalContext?: string;
  /** Full educational content (lazy loaded) */
  education?: EducationalContent;
  /** Whether detailed education has been loaded */
  educationLoaded?: boolean;
}

// ============================================================================
// TYPE GUARDS
// ============================================================================

/**
 * Type guard for global lint rules.
 */
export function isGlobalRule(rule: LintRule | GlobalLintRule): rule is GlobalLintRule {
  return 'isGlobal' in rule && rule.isGlobal === true;
}

/**
 * Type guard to check if a value is a valid severity.
 */
export function isValidSeverity(value: unknown): value is RuleSeverity {
  return value === 'info' || value === 'warning' || value === 'error';
}

/**
 * Type guard to check if a value is a valid category.
 */
export function isValidCategory(value: unknown): value is RuleCategory {
  return ['workflow', 'sampling', 'model', 'vae', 'performance', 'prompt', 'compatibility'].includes(
    value as string
  );
}
