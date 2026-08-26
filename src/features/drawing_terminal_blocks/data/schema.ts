import { z } from "zod";
import { engineeringAttributeContainerSchema } from "@/features/engineering_attributes/api/public";
import { drawingComponentSelectionsSchema } from "@/features/symbol_components/api/public";

export const terminalBlockOrientationSchema = z.literal("horizontal");

export const terminalBlockModuleTemplateSchema = z.object({
  symbolId: z.string().trim().min(1),
  versionId: z.string().trim().min(1),
  pitchMm: z.number().positive(),
  heightMm: z.number().positive()
});

export const terminalBlockPlacementSchema = z.object({
  kind: z.literal("modular_terminal_strip"),
  count: z.number().int().min(1).max(80),
  startNumber: z.number().int().min(1).max(9999),
  orientation: terminalBlockOrientationSchema.default("horizontal"),
  modulePitch: z.number().positive(),
  moduleWidth: z.number().positive(),
  moduleHeight: z.number().positive(),
  moduleTemplate: terminalBlockModuleTemplateSchema.optional()
});

export const structuredTerminalStripMemberRoleSchema = z.enum([
  "electrical",
  "end_bracket",
  "accessory"
]);

export const structuredTerminalStripMemberSchema = z.object({
  id: z.string().trim().min(1).max(120),
  token: z.string().trim().regex(/^M\d{2,}$/),
  symbolId: z.string().trim().min(1).max(120),
  versionId: z.string().trim().min(1).max(120),
  role: structuredTerminalStripMemberRoleSchema,
  designation: z.string().trim().min(1).max(80).optional(),
  title: z.string().trim().max(160).optional(),
  description: z.string().trim().max(400).optional(),
  engineeringAttributes: engineeringAttributeContainerSchema.optional(),
  componentSelections: drawingComponentSelectionsSchema.optional()
});

export const structuredTerminalStripSchema = z
  .object({
    kind: z.literal("structured_terminal_strip"),
    nextMemberNumber: z.number().int().positive(),
    members: z.array(structuredTerminalStripMemberSchema).min(1).max(82)
  })
  .superRefine((strip, context) => {
    const ids = new Set<string>();
    const tokens = new Set<string>();
    const designations = new Set<string>();
    let maxTokenNumber = 0;
    let electricalCount = 0;
    let bracketCount = 0;

    strip.members.forEach((member, index) => {
      if (ids.has(member.id)) {
        context.addIssue({
          code: "custom",
          message: `Member id "${member.id}" is duplicated.`,
          path: ["members", index, "id"]
        });
      }
      ids.add(member.id);

      if (tokens.has(member.token)) {
        context.addIssue({
          code: "custom",
          message: `Member token "${member.token}" is duplicated.`,
          path: ["members", index, "token"]
        });
      }
      tokens.add(member.token);
      maxTokenNumber = Math.max(
        maxTokenNumber,
        Number(member.token.slice(1)) || 0
      );

      if (member.role === "electrical") {
        electricalCount += 1;
        const normalizedDesignation = member.designation?.trim().toLocaleLowerCase();
        if (!normalizedDesignation) {
          context.addIssue({
            code: "custom",
            message: "Electrical members require a designation.",
            path: ["members", index, "designation"]
          });
        } else if (designations.has(normalizedDesignation)) {
          context.addIssue({
            code: "custom",
            message: `Designation "${member.designation}" is duplicated.`,
            path: ["members", index, "designation"]
          });
        } else {
          designations.add(normalizedDesignation);
        }
      }

      if (member.role === "end_bracket") {
        bracketCount += 1;
        if (index !== 0 && index !== strip.members.length - 1) {
          context.addIssue({
            code: "custom",
            message: "End brackets must remain at the outer edges of the strip.",
            path: ["members", index]
          });
        }
      }
    });

    if (electricalCount === 0) {
      context.addIssue({
        code: "custom",
        message: "A structured terminal strip requires an electrical member.",
        path: ["members"]
      });
    }

    if (electricalCount > 80) {
      context.addIssue({
        code: "custom",
        message: "A structured terminal strip supports at most 80 electrical members.",
        path: ["members"]
      });
    }

    if (bracketCount > 2) {
      context.addIssue({
        code: "custom",
        message: "A structured terminal strip supports at most two end brackets.",
        path: ["members"]
      });
    }

    if (strip.nextMemberNumber <= maxTokenNumber) {
      context.addIssue({
        code: "custom",
        message: "The next member number must be greater than every allocated token.",
        path: ["nextMemberNumber"]
      });
    }
  });

export type TerminalBlockOrientation = z.infer<
  typeof terminalBlockOrientationSchema
>;
export type TerminalBlockModuleTemplate = z.infer<
  typeof terminalBlockModuleTemplateSchema
>;
export type TerminalBlockPlacement = z.infer<typeof terminalBlockPlacementSchema>;
export type StructuredTerminalStripMemberRole = z.infer<
  typeof structuredTerminalStripMemberRoleSchema
>;
export type StructuredTerminalStripMember = z.infer<
  typeof structuredTerminalStripMemberSchema
>;
export type StructuredTerminalStrip = z.infer<
  typeof structuredTerminalStripSchema
>;
export type TerminalBlockGroupDefinition = TerminalBlockPlacement;
