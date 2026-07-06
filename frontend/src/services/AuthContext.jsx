import React, { createContext, useContext, useState, useCallback } from "react";
import { api } from "./api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("raqib_user"));
    } catch { return null; }
  });

const login = useCallback(async (email, password) => {
  const res = await fetch("https://localhost:7212/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  const data = await res.json();

  if (!res.ok) {
    // بعت الـ error كـ JSON string عشان LoginPage يقدر يقراه
    throw new Error(JSON.stringify(data));
  }

  localStorage.setItem("raqib_token", data.token);
  localStorage.setItem("raqib_user", JSON.stringify(data));
  setUser(data);
  return data;
}, []);

  const logout = useCallback(() => {
    localStorage.removeItem("raqib_token");
    localStorage.removeItem("raqib_user");
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, login, logout, isAdmin: user?.role === "Admin" }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
