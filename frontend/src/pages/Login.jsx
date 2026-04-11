import { useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { Eye, EyeOff, Lock, User,AlertTriangle } from "lucide-react"; 
import myLogo from "../Assets/logo.png";

const Login = () => {
  const [employeeId, setEmployeeId] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const API_BASE = process.env.REACT_APP_API_URL;

  const handleLogin = async (e) => {
    if (e) e.preventDefault();
    
    // Reset error and start loading state
    setErrorMsg("");
    setIsLoading(true);

    try {
      const res = await axios.post(`${API_BASE}/auth/login`, { employeeId, password });

      // ✅ res.data = { username, role }
      localStorage.setItem("user", JSON.stringify(res.data));

      const role = res.data.role;

      if (role === "admin") navigate("/admin");
      else if (role === "supervisor") navigate("/supervisor");
      else if (role === "operator") navigate("/operator");
      else if (role === "hod") navigate("/hod");
      else if (role === "hof") navigate("/hof");
      else navigate("/"); // Fallback just in case

    } catch (err) {
      // Set inline error instead of using alert()
      setErrorMsg(
        err.response?.data?.message || err.response?.data?.error || "Invalid credentials. Please try again."
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-gray-50 font-sans">
      
      {/* LEFT PANEL - Branding & Decor (Hidden on smaller screens) */}
      <div className="hidden lg:flex lg:w-1/2 relative bg-[#2d2d2d] items-center justify-center overflow-hidden">
        {/* Abstract Glowing Background Elements */}
        <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-[#ff9100] rounded-full mix-blend-overlay filter blur-[120px] opacity-20 animate-pulse"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-blue-500 rounded-full mix-blend-overlay filter blur-[120px] opacity-20"></div>

        <div className="relative z-10 flex flex-col items-center text-center px-10">
          <div className="bg-white p-8 rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] mb-10 border border-white/10">
            <img src={myLogo} alt="Sakthi Auto" className="w-40 h-auto object-contain" />
          </div>
          <h1 className="text-4xl font-black text-white uppercase tracking-[0.15em] mb-4">
            Sakthi Auto
          </h1>
          <p className="text-xl text-[#ff9100] font-bold uppercase tracking-widest">
            Component Limited
          </p>
          <p className="mt-6 text-gray-400 font-medium tracking-wide max-w-sm">
            Internal Production & Quality Management Portal
          </p>
          <div className="mt-12 w-20 h-1.5 bg-[#ff9100] rounded-full shadow-[0_0_15px_rgba(255,145,0,0.5)]"></div>
        </div>
      </div>

      {/* RIGHT PANEL - Login Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 sm:p-12 lg:p-24 bg-white relative">
        <div className="w-full max-w-md">
          
          {/* Mobile Logo (Only visible on small screens) */}
          <div className="lg:hidden flex flex-col items-center mb-10">
            <div className="bg-white p-4 rounded-2xl shadow-lg border border-gray-100 mb-4">
              <img src={myLogo} alt="SA Logo" className="w-24 h-24 object-contain" />
            </div>
            <p className="text-xs font-bold text-[#ff9100] uppercase tracking-[0.2em]">Sakthi Auto Component Ltd</p>
          </div>

          <div className="mb-10 text-left">
            <h2 className="text-3xl font-black text-gray-800 uppercase tracking-wide mb-2">Welcome Back</h2>
            <p className="text-sm font-bold text-gray-400 uppercase tracking-widest">Sign in to your account</p>
          </div>

          {/* Inline Error Message */}
          {errorMsg && (
            <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 text-red-700 text-sm font-bold rounded-r-lg flex items-center gap-3 animate-in fade-in slide-in-from-top-2">
              <AlertTriangle className="w-5 h-5 flex-shrink-0" />
              <p>{errorMsg}</p>
            </div>
          )}

          <form className="space-y-6" onSubmit={handleLogin}>
            
            {/* Employee ID Input */}
            <div>
              <label className="block text-xs font-black uppercase tracking-widest text-gray-500 mb-2 ml-1">Employee ID</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none transition-colors group-focus-within:text-[#ff9100]">
                  <User className="h-5 w-5 text-gray-400 group-focus-within:text-[#ff9100] transition-colors" />
                </div>
                <input
                  type="text"
                  required
                  placeholder="Enter your Employee ID"
                  className="w-full pl-12 pr-5 py-4 bg-gray-50 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-[#ff9100] focus:bg-white focus:ring-4 focus:ring-[#ff9100]/10 transition-all text-gray-800 font-bold placeholder:text-gray-400"
                  value={employeeId}
                  onChange={(e) => setEmployeeId(e.target.value)}
                />
              </div>
            </div>

            {/* Password Input */}
            <div>
              <label className="block text-xs font-black uppercase tracking-widest text-gray-500 mb-2 ml-1">Password</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-gray-400 group-focus-within:text-[#ff9100] transition-colors" />
                </div>
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  placeholder="••••••••"
                  className="w-full pl-12 pr-12 py-4 bg-gray-50 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-[#ff9100] focus:bg-white focus:ring-4 focus:ring-[#ff9100]/10 transition-all text-gray-800 font-bold placeholder:text-gray-400"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-400 hover:text-[#ff9100] transition-colors"
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading || !employeeId || !password}
              className="w-full bg-[#ff9100] hover:bg-orange-600 text-white font-black text-lg py-4 rounded-xl shadow-lg hover:shadow-[0_10px_20px_rgba(255,145,0,0.3)] transition-all transform hover:-translate-y-1 active:translate-y-0 active:scale-95 uppercase tracking-widest mt-8 flex items-center justify-center gap-3 disabled:opacity-60 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none"
            >
              {isLoading ? (
                <>
                  <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Authenticating...
                </>
              ) : (
                <>
                  Secure Login
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </>
              )}
            </button>
          </form>

        </div>
      </div>
    </div>
  );
};

export default Login;