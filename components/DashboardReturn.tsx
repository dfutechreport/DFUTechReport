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
        if (snap.exists()) {
          const role = snap.data().role;
          setUserRole(role ? role.toLowerCase().trim() : "");
        }
      }
    });
    return () => unsubscribe();
  }, []);

  const handleBack = () => {
    switch (userRole) {
      case "admin": router.push("/admin"); break;
      case "isg": router.push("/isg"); break;
      case "ik": router.push("/admin/mesai"); break;
      case "depo": router.push("/admin/yedek-parca"); break;
      case "uretim": router.push("/admin/tamamlanan-isler"); break;
      default: router.push("/dashboard"); break;
    }
  };

  return (
    <button 
      onClick={handleBack}
      className="bg-slate-800 hover:bg-white hover:text-black px-10 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all shadow-2xl text-white italic"
    >
      dashboarda dön
    </button>
  );
}
