import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import Header from "../components/Header";

const API_BASE = process.env.REACT_APP_API_URL && process.env.REACT_APP_API_URL !== "undefined"
  ? process.env.REACT_APP_API_URL
  : "/api";

const AddUser = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    username: "",
    employeeId: "",
    password: "",
    role: "operator",
  });

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.username || !formData.employeeId || !formData.password || !formData.role) {
      toast.warning("Please fill out all fields.");
      return;
    }

    try {
      await axios.post(`${API_BASE}/users/add`, formData);
      toast.success(`User ${formData.username} added successfully!`);

      setFormData({ username: "", employeeId: "", password: "", role: "operator" });

      // 🔥 Send them back to "/admin" after a short delay
      setTimeout(() => navigate("/admin"), 1500);
    } catch (err) {
      const errorMsg = err.response?.data?.error || "Failed to add user.";
      toast.error(errorMsg);
    }
  };

  return (
    <>
      <Header />
      <ToastContainer position="top-right" autoClose={3000} hideProgressBar={false} />

      <div className="min-h-screen bg-[#2d2d2d] flex flex-col items-center justify-center p-6">
        <div className="bg-white w-full max-w-md rounded-xl p-8 shadow-2xl">
          <h2 className="text-2xl font-bold mb-6 text-center text-gray-800 border-b pb-3">
            Create New User
          </h2>

          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <div>
              <label className="block text-gray-700 font-bold mb-2">Name / Username</label>
              <input
                type="text"
                name="username"
                value={formData.username}
                onChange={handleChange}
                placeholder="Enter username"
                className="w-full border p-3 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50"
              />
            </div>

            <div>
              <label className="block text-gray-700 font-bold mb-2">Employee ID</label>
              <input
                type="text"
                name="employeeId"
                value={formData.employeeId}
                onChange={handleChange}
                placeholder="Enter employee ID"
                className="w-full border p-3 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50"
              />
            </div>

            <div>
              <label className="block text-gray-700 font-bold mb-2">Password</label>
              <input
                type="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                placeholder="Enter password"
                className="w-full border p-3 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50"
              />
            </div>

            <div>
              <label className="block text-gray-700 font-bold mb-2">Role</label>
              <select
                name="role"
                value={formData.role}
                onChange={handleChange}
                className="w-full border p-3 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white cursor-pointer"
              >
                <option value="operator">Operator</option>
                <option value="pp operator">PP Operator</option>
                <option value="supervisor">Supervisor</option>
                <option value="hod">HOD (Head of Dept)</option>
                <option value="hof">HOF (Head of Factory)</option>
              </select>
            </div>

            <div className="flex justify-between mt-4">
              <button
                type="button"
                // 🔥 Cancel button now redirects to "/admin"
                onClick={() => navigate("/admin")}
                className="bg-gray-300 hover:bg-gray-400 text-gray-800 px-6 py-2 rounded font-bold transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-2 rounded font-bold transition-colors shadow-md"
              >
                Save User
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
};

export default AddUser;