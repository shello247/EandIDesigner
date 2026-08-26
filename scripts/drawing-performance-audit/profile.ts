import {guard} from "./common";
import {createLargePanelPerformanceSource} from "../../src/features/drawing_panel_wiring/tests/release-fixtures";
import {buildPanelEngineeringSnapshot} from "../../src/features/drawing_panel_wiring/logic/services/panel-engineering-snapshot";
guard();
const source=createLargePanelPerformanceSource();
for(let i=0;i<15;i++)buildPanelEngineeringSnapshot(source,"profile");
console.log("Diagnostic source/connectivity CPU profile workload complete; not a baseline timing sample.");
