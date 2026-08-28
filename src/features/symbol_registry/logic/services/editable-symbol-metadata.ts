import type {
  SaveSymbolMetadataChangesInput,
  SymbolMetadata
} from "../../data/schema";

type MetadataChanges = Omit<
  SaveSymbolMetadataChangesInput,
  "symbolId" | "versionId"
>;

function mergeComponentConfiguration(
  stored: SymbolMetadata["componentPositions"],
  submitted: MetadataChanges["componentPositions"]
): SymbolMetadata["componentPositions"] {
  const storedPositions = stored ?? [];
  const submittedPositions = submitted ?? [];

  if (storedPositions.length !== submittedPositions.length) {
    throw new Error(
      "Component positions are controlled by the imported Figma artwork and cannot be added or removed here."
    );
  }

  if (storedPositions.length === 0) {
    return undefined;
  }

  const submittedByKey = new Map(
    submittedPositions.map((position) => [position.key, position])
  );

  return storedPositions.map((storedPosition) => {
    const submittedPosition = submittedByKey.get(storedPosition.key);
    if (
      !submittedPosition ||
      submittedPosition.components.length !== storedPosition.components.length
    ) {
      throw new Error(
        `Component position "${storedPosition.label}" no longer matches its Figma-authored definition.`
      );
    }

    const submittedComponents = new Map(
      submittedPosition.components.map((component) => [component.key, component])
    );

    return {
      ...storedPosition,
      required: submittedPosition.required,
      components: storedPosition.components.map((storedComponent) => {
        const submittedComponent = submittedComponents.get(storedComponent.key);
        if (!submittedComponent) {
          throw new Error(
            `Component "${storedComponent.label}" no longer matches its Figma-authored definition.`
          );
        }

        return {
          ...storedComponent,
          allowedSymbolIds: submittedComponent.allowedSymbolIds
        };
      })
    };
  });
}

export function mergeEditableSymbolMetadata(
  stored: SymbolMetadata,
  changes: MetadataChanges
): SymbolMetadata {
  const isNetworkSymbol = stored.category === "network_device";

  if (isNetworkSymbol && !changes.networkProfile) {
    throw new Error("Network symbols require a network profile.");
  }

  if (!isNetworkSymbol && (changes.networkProfile || changes.networkIdentity)) {
    throw new Error(
      "Network identity and profile metadata can only be changed on network symbols."
    );
  }

  const manufacturer = isNetworkSymbol
    ? changes.networkIdentity?.manufacturer?.trim() || undefined
    : stored.manufacturer;
  const model = isNetworkSymbol
    ? changes.networkIdentity?.model?.trim() || undefined
    : stored.model;

  return {
    ...stored,
    displayName: changes.registryDetails.displayName.trim(),
    description: changes.registryDetails.description?.trim() || undefined,
    ...changes.layout,
    manufacturer,
    model,
    panelWiring: changes.panelWiring
      ? {
          ...changes.panelWiring,
          tagPrefix: changes.panelWiring.tagPrefix.trim().toUpperCase()
        }
      : undefined,
    electricalTopology: changes.electricalTopology,
    terminals: changes.terminals.map((terminal) => ({
      ...terminal,
      function: terminal.function?.trim() || undefined
    })),
    componentPositions: mergeComponentConfiguration(
      stored.componentPositions,
      changes.componentPositions
    ),
    networkProfile: isNetworkSymbol ? changes.networkProfile : undefined
  };
}
