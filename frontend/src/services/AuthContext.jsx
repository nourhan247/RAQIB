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
  try {
    const data = await api.login({ email, password });
    localStorage.setItem("raqib_token", data.token);
    localStorage.setItem("raqib_user", JSON.stringify(data));
    setUser(data);
    return data;
  } catch (err) {
    throw err;
  }
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
