import { useParams } from "react-router-dom";
import DISASettingAdjustment from "./DISASettingAdjustment";
import DisamaticProductReport from "./DisamaticProductReport";
import DisaMachineCheckList from "./DisaMachineCheckList";
import FourMChangeMonitoring from "./FourMChangeMonitoring";
import ErrorProofVerification from "./ErrorProofVerification";
import UnPouredMouldDetails from "./UnPouredMouldDetails";
import DmmSettingParameters from "./DmmSettingParameters";
import BottomLevelAudit from "./BottomLevelAudit";
import ErrorProofVerification2 from "./ErrorProofVerification2";
import DailyProductionPerformance from "./DailyProductionPerformance";
import MouldingQualityInspection from "./MouldingQualityInspection";

/**
 * Central map for operator forms
 * Add new forms here ONLY
 */
const formMap = {
  "disa-setting-adjustment": <DISASettingAdjustment />,
   "disamatic-report": <DisamaticProductReport />,
   "disa-operator": <DisaMachineCheckList />,
   "4m-change-monitoring": <FourMChangeMonitoring />,
   "error-proof":<ErrorProofVerification />,
   "unpoured-mould":<UnPouredMouldDetails />,
   "dmm-setting-parameters-checklist": <DmmSettingParameters />,
   "lpa":<BottomLevelAudit />,
   "error-proof-2": <ErrorProofVerification2 />,
   "product": <DailyProductionPerformance />,
   "moulding-quality-inspection": <MouldingQualityInspection />,
  // Future forms (example)
  // "product": <ProductForm />,
  // "performance": <PerformanceForm />,
};

const FormPlaceholder = () => {
  const { formName } = useParams();

  // If real form exists → render it
  if (formMap[formName]) {
    return formMap[formName];
  }

  // Otherwise → show placeholder
  return (
    <div className="min-h-screen bg-[#2d2d2d] flex items-center justify-center">
      <div className="bg-white rounded-xl shadow-2xl p-10 text-center">
        <h1 className="text-3xl font-bold text-gray-800 mb-4">
          {formName.replace(/-/g, " ").toUpperCase()}
        </h1>
        <p className="text-gray-500">
          Form will be implemented here
        </p>
      </div>
    </div>
  );
};

export default FormPlaceholder;