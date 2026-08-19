import os

# MASTER v47 - ABSOLUTE HIERARCHY REBUILD
# Bu dosya app/admin/page.tsx dosyasını EN BAŞTAN hatasız yazar.

def apply_ultimate_fix():
    path = "app/admin/page.tsx"
    
    # Not: Kodun tamamı aşağıdadır. Hiçbir parça eksik değildir.
    full_code = r""" "use client";
import { useEffect, useState } from "react";
import { collection, getDocs, doc, getDoc, query, where, orderBy, updateDoc, setDoc, serverTimestamp, limit } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "../../lib/firebase"; 
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import Link from "next/link";

export default function AdminDashboard() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [userRole, setUserRole] = useState(""); 
  const [userName, setUserName] = useState(""); 
  const [loading, setLoading] = useState(true);
  
  const [rawLogs, setRawLogs] = useState<any[]>([]);
  const [rcaLogs, setRcaLogs] = useState<any[]>([]);
  const [aktifIsler, setAktifIsler] = useState<any[]>([]);
  const [aktifIsgAlarmlari, setAktifIsgAlarmlari] = useState<any[]>([]);
  const [aktifEked, setAktifEked] = useState<any[]>([]);
  
  const [showScoreInfo, setShowScoreInfo] = useState(false);
  const [showFinanceInfo, setShowFinanceInfo] = useState(false);
  const [bakimLigi, setBakimLigi] = useState<any[]>([]);
  