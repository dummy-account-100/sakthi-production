import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
// Import the logo from your Assets folder
import logo from "../assets/logo.png";

const Header = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);

  useEffect(() => {
    const data = localStorage.getItem("user");
    if (data) {
      setUser(JSON.parse(data));
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("user");
    navigate("/", { replace: true });
  };

  if (!user) return null;

  return (
    <div className="flex justify-between items-center px-6 py-3 bg-gray-800 text-white shadow-md">

      {/* 1. Logo Section (Left) */}
      <div className="flex-1 flex justify-start">
        <img
          src={logo}
          alt="Sakthi Auto"
          className="h-10 w-auto object-contain bg-white p-1 rounded"
        />
      </div>

      {/* 2. User Role Section (Middle) */}
      <div className="flex-1 text-center">
        <h1 className="text-xl font-semibold tracking-wide">
          {user.role.toUpperCase()} DASHBOARD
        </h1>
      </div>

      {/* 3. Logout Section (Right) */}
      <div className="flex-1 flex justify-end">
        <button
          onClick={handleLogout}
          className="bg-orange-600 hover:bg-red-600 px-5 py-2 rounded font-medium transition-colors"
        >
          Logout
        </button>
      </div>

    </div>
  );
};

export default Header;