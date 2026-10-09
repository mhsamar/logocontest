"use client";

import { createContext, useContext } from "react";

/**
 * True on an admin page the signed-in staff member may only view (BLUEPRINT §13.2 item 2): action
 * buttons hide themselves and forms become read-only. The server checks every action anyway.
 */
const ReadOnlyContext = createContext(false);

export const ReadOnlyProvider = ReadOnlyContext.Provider;
export const useReadOnly = () => useContext(ReadOnlyContext);
