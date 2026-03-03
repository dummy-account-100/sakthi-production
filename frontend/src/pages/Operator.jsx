import { useNavigate } from "react-router-dom";
import Header from "../components/Header";
const Operator = () => {
  const navigate = useNavigate();

  const buttons = [
    { name: "Daily Performance Report", path: "/operator/product" },
    
    { name: "DISAmatic Production Report", path: "/operator/disamatic-report" },
    { name: "Unpoured Mould Details", path: "/operator/unpoured-mould" },
    {name:"Moulding Quality Inspection", path:"/operator/moulding-quality-inspection"},

    // ✅ MATCHES FORM PLACEHOLDER KEY
    { name: "DISA Setting Adjustment", path: "/operator/disa-setting-adjustment" },

    { name: "DISA Operator Checklist", path: "/operator/disa-operator" },
    { name: "Layered Process Audit", path: "/operator/lpa" },
    { name: "DMM setting parameters checklist", path: "/operator/dmm-setting-parameters-checklist" },
    { name: "Error Proof Verification", path: "/operator/error-proof" },
    { name: "Error Proof Verification 2", path: "/operator/error-proof-2" },
    { name: "4M Change Monitoring", path: "/operator/4m-change-monitoring" },
  ];

  return (
    <div className="h-screen w-screen bg-[#2d2d2d] flex flex-col overflow-hidden">

      {/* Top Border */}
      <div className="h-1.5 bg-[#ff9100]" />

      {/* Header */}
      {/* <div className="py-10 flex flex-col items-center">
        <h1 className="text-4xl font-black text-white uppercase text-center">
          Operator Dashboard
        </h1>
        <div className="w-32 h-1 bg-[#ff9100] mt-2 rounded-full" />
      </div> */}

      <Header />
      
      {/* Buttons Grid */}
      <div className="flex-1 flex justify-center items-center px-10 pb-10">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl w-full">
          {buttons.map((btn) => (
            <button
              key={btn.path}
              onClick={() => navigate(btn.path)}
              className="
                bg-[#383838]
                text-white
                rounded-2xl
                p-6
                font-bold
                shadow-xl
                transition
                hover:bg-[#ff9100]
                hover:scale-105
                active:scale-95
              "
            >
              {btn.name}
            </button>
          ))}
        </div>
      </div>

      {/* Bottom Border */}
      <div className="h-1.5 bg-[#ff9100]" />
    </div>
  );
};

export default Operator;