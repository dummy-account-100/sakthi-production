import { useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import myLogo from "../Assets/logo.png";

const Login = () => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const navigate = useNavigate();

  const handleLogin = async () => {
    try {
      const res = await axios.post(
        `${process.env.REACT_APP_API_URL}/api/auth/login`,
        { username, password }
      );

      // ✅ res.data = { username, role }
      localStorage.setItem("user", JSON.stringify(res.data));

      const role = res.data.role;

      if (role === "admin") navigate("/admin");
      else if (role === "supervisor") navigate("/supervisor");
      else if (role === "operator") navigate("/operator");
      else if (role === "hod") navigate("/hod");
      else if (role === "hof") navigate("/hof");

    } catch (err) {
      alert("Invalid credentials");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#2d2d2d] relative overflow-hidden font-sans p-4">
      
      {/* Decorative Background Glows */}
      <div className="absolute top-[-15%] left-[-10%] w-[500px] h-[500px] bg-[#ff9100] rounded-full mix-blend-overlay filter blur-[120px] opacity-30 animate-pulse"></div>
      <div className="absolute bottom-[-15%] right-[-10%] w-[500px] h-[500px] bg-blue-500 rounded-full mix-blend-overlay filter blur-[120px] opacity-20"></div>

      <div className="w-full max-w-md bg-white p-10 rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] z-10 relative border border-white/20 backdrop-blur-sm">
        
        <div className="text-center mb-10">
          <div className="w-20 h-20 bg-white-100  flex items-center justify-center mx-auto mb-4  border-2 border-gray-200">
            <img src={myLogo} alt="SA" />
          </div>
          <h2 className="text-3xl font-black text-gray-800 uppercase tracking-widest mb-2">Welcome</h2>
          <p className="text-xs font-bold text-[#ff9100] uppercase tracking-[0.2em]">Sakthi Auto Component Limited</p>
        </div>

        <div className="space-y-6">
          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-gray-500 mb-2 ml-1">Username</label>
            <input
              type="text"
              placeholder="Enter your username"
              className="w-full px-5 py-4 bg-gray-50 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-[#ff9100] focus:bg-white transition-all text-gray-800 font-bold placeholder:text-gray-400"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-gray-500 mb-2 ml-1">Password</label>
            <input
              type="password"
              placeholder="Enter your password"
              className="w-full px-5 py-4 bg-gray-50 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-[#ff9100] focus:bg-white transition-all text-gray-800 font-bold placeholder:text-gray-400"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <button
            onClick={handleLogin}
            className="w-full bg-gradient-to-r from-[#ff9100] to-orange-600 hover:from-orange-500 hover:to-orange-700 text-white font-black text-lg py-4 rounded-xl shadow-[0_10px_20px_rgba(255,145,0,0.3)] hover:shadow-[0_15px_25px_rgba(255,145,0,0.4)] transition-all transform hover:-translate-y-1 active:translate-y-0 active:scale-95 uppercase tracking-widest mt-6 flex items-center justify-center gap-3"
          >
            Secure Login
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M3 3a1 1 0 011 1v12a1 1 0 11-2 0V4a1 1 0 011-1zm7.707 3.293a1 1 0 010 1.414L6.414 9H17a1 1 0 110 2H6.414l4.293 4.293a1 1 0 01-1.414 1.414l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 0z" clipRule="evenodd" className="hidden" />
              <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
        
      </div>
    </div>
  );
};

export default Login;