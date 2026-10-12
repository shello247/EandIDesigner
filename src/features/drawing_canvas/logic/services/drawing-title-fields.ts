import type { DrawingModel } from "../../data/schema";

export const drawingTitleBlockFields: Array<{
  key: keyof DrawingModel["titleBlock"];
  label: string;
  placeholder: string;
}> = [
  { key: "client", label: "Client", placeholder: "Client name" },
  { key: "project", label: "Printed project / process", placeholder: "Printed project name" },
  { key: "drawingNumber", label: "Drawing number", placeholder: "EI-001" },
  { key: "revision", label: "Revision", placeholder: "A" },
  { key: "preparedBy", label: "Prepared by", placeholder: "Designer name" },
  { key: "checkedBy", label: "Checked by", placeholder: "Engineer name" },
  { key: "date", label: "Date", placeholder: "YYYY-MM-DD" }
];
