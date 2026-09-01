'use client';
import { useEffect, useState } from "react";
import { auth, db } from "../lib/firebase"; 
import { doc, getDoc } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";

export default function DashboardReturn() {
  const router = useRouter();
  const [userRole, setUserRole] = useState("");

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const snap = await getDoc(doc(db, "users", user.uid));
        if (snap.exists()) setUserRole(snap.data().role);
      }
    });
    return () => unsubscribe();
  }, []);

  const handleBack = () => {
    if (userRole === "admin") router.push("/admin");
    else if (userRole === "isg") router.push("/isg");
    else if (userRole === "ik") router.push("/admin/mesai");
    else router.push("/dashboard");
  };

  return (
    <button 
      onClick={handleBack}
      className="bg-slate-800 hover:bg-white hover:text-black px-10 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all shadow-2xl text-white"
    >
      dashboarda dön
    </button>
  );
}
