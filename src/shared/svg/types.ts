export type SvgValidationIssue = {
  severity: "blocking" | "warning" | "info";
  code: string;
  message: string;
  path?: string;
};

