import React, { useState, useEffect } from "react";
import { AppUserRecord, UserRole } from "../types";
import { 
  getAppUsers, 
  saveAppUserRole, 
  deleteAppUser 
} from "../lib/dbService";
import { 
  ShieldCheck, 
  Shield, 
  Users, 
  UserPlus, 
  Trash2, 
  Crown, 
  Search, 
  RefreshCw, 
  CheckCircle2, 
  AlertTriangle, 
  Info, 
  Lock, 
  Mail,
  UserCheck,
  Calendar,
  X
} from "lucide-react";

interface UserRoleManagementProps {
  currentUserEmail: string;
  isSuperAdmin: boolean;
  onToast: (msg: string) => void;
}

const SUPER_ADMIN_EMAIL = "pousan888@gmail.com";

export default function UserRoleManagement({
  currentUserEmail,
  isSuperAdmin,
  onToast
}: UserRoleManagementProps) {
  const [users, setUsers] = useState<AppUserRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  // Add / Edit User Modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [formEmail, setFormEmail] = useState("");
  const [formName, setFormName] = useState("");
  const [formRole, setFormRole] = useState<UserRole>("HELPER");
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Delete confirmation modal
  const [userToDelete, setUserToDelete] = useState<AppUserRecord | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const list = await getAppUsers();
      setUsers(list);
    } catch (err) {
      console.error("Error loading users:", err);
      onToast("เกิดข้อผิดพลาดในการโหลดรายชื่อผู้ใช้");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    loadUsers();
  };

  // Change role directly from table
  const handleRoleChange = async (targetUser: AppUserRecord, newRole: UserRole) => {
    if (targetUser.email.toLowerCase() === SUPER_ADMIN_EMAIL || targetUser.isSuperAdmin) {
      onToast("ไม่สามารถเปลี่ยนบทบาทของผู้ดูแลระบบสูงสุดได้");
      return;
    }

    try {
      const updated = await saveAppUserRole(
        targetUser.email,
        targetUser.name,
        newRole,
        currentUserEmail
      );
      setUsers(prev => prev.map(u => u.id === updated.id ? updated : u));
      onToast(`อัปเดตสิทธิ์ของ ${targetUser.email} เป็น "${getRoleNameTh(newRole)}" เรียบร้อยแล้ว`);
    } catch (err) {
      console.error("Failed to update user role:", err);
      onToast("เกิดข้อผิดพลาดในการบันทึกสิทธิ์");
    }
  };

  // Submit Add / Pre-assign User
  const handleAddUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const emailClean = formEmail.trim().toLowerCase();
    if (!emailClean) {
      setFormError("กรุณากรอกอีเมลของผู้ใช้งาน");
      return;
    }
    if (!emailClean.includes("@") || !emailClean.includes(".")) {
      setFormError("รูปแบบอีเมลไม่ถูกต้อง (เช่น user@example.com)");
      return;
    }

    setSubmitting(true);
    try {
      const saved = await saveAppUserRole(
        emailClean,
        formName.trim() || emailClean.split("@")[0],
        formRole,
        currentUserEmail
      );
      
      setUsers(prev => {
        const idx = prev.findIndex(u => u.email.toLowerCase() === emailClean);
        if (idx !== -1) {
          const next = [...prev];
          next[idx] = saved;
          return next;
        }
        return [saved, ...prev];
      });

      onToast(`กำหนดสิทธิ์ผู้ใช้งาน ${emailClean} เป็น "${getRoleNameTh(formRole)}" สำเร็จ!`);
      setShowAddModal(false);
      setFormEmail("");
      setFormName("");
      setFormRole("HELPER");
    } catch (err: any) {
      setFormError(err?.message || "ไม่สามารถบันทึกผู้ใช้ได้");
    } finally {
      setSubmitting(false);
    }
  };

  // Delete User Confirmation
  const confirmDelete = async () => {
    if (!userToDelete) return;
    if (userToDelete.email.toLowerCase() === SUPER_ADMIN_EMAIL || userToDelete.isSuperAdmin) {
      onToast("ไม่สามารถลบผู้ดูแลระบบสูงสุดได้");
      setUserToDelete(null);
      return;
    }

    setDeleting(true);
    try {
      await deleteAppUser(userToDelete.id);
      setUsers(prev => prev.filter(u => u.id !== userToDelete.id));
      onToast(`ลบผู้ใช้ ${userToDelete.email} ออกจากระบบเรียบร้อย`);
      setUserToDelete(null);
    } catch (err: any) {
      onToast(err?.message || "เกิดข้อผิดพลาดในการลบผู้ใช้");
    } finally {
      setDeleting(false);
    }
  };

  // Helpers
  const getRoleNameTh = (role: UserRole) => {
    switch (role) {
      case "ADMIN":
        return "แอดมิน (Admin)";
      case "QC":
        return "เจ้าหน้าที่ QC";
      case "HELPER":
        return "ทีมนับสต็อก (Helper)";
    }
  };

  const filteredUsers = users.filter(u => {
    const term = searchTerm.toLowerCase();
    return (
      u.email.toLowerCase().includes(term) ||
      (u.name && u.name.toLowerCase().includes(term)) ||
      u.role.toLowerCase().includes(term)
    );
  });

  const adminCount = users.filter(u => u.role === "ADMIN" && !u.isSuperAdmin && u.email.toLowerCase() !== SUPER_ADMIN_EMAIL).length;
  const qcCount = users.filter(u => u.role === "QC").length;
  const helperCount = users.filter(u => u.role === "HELPER").length;

  // Security Check
  if (!isSuperAdmin && currentUserEmail.toLowerCase() !== SUPER_ADMIN_EMAIL) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-8 text-center max-w-2xl mx-auto my-8 shadow-xs">
        <div className="h-16 w-16 bg-amber-100 text-amber-700 rounded-full flex items-center justify-center mx-auto mb-4">
          <Lock className="h-8 w-8" />
        </div>
        <h3 className="text-xl font-bold text-slate-900 mb-2">เฉพาะผู้ดูแลระบบสูงสุดเท่านั้น</h3>
        <p className="text-slate-600 text-sm leading-relaxed mb-4">
          สำหรับผู้ใช้ที่เป็น <b>แอดมิน (Admin)</b> จะไม่สามารถจัดการสิทธิ์ผู้ใช้งานได้ 
          ผู้ที่สามารถกำหนดและแก้ไขสิทธิ์ต้องเป็นผู้ดูแลระบบสูงสุด (Super Admin: {SUPER_ADMIN_EMAIL}) เท่านั้น
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* HEADER SUMMARY CARD */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-3xl p-6 sm:p-8 shadow-md relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-400/20 text-amber-300 text-xs font-bold border border-amber-400/30">
              <Crown className="h-3.5 w-3.5" />
              <span>พื้นที่เฉพาะผู้ดูแลระบบสูงสุด (Super Admin Privilege)</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black font-display tracking-tight text-white">
              จัดการสิทธิ์ผู้ใช้งานระบบ
            </h2>
            <p className="text-slate-300 text-xs sm:text-sm max-w-2xl leading-relaxed">
              กำหนดสิทธิ์การใช้งานของแต่ละบุคคลตามหน้าที่: แอดมิน (Admin), เจ้าหน้าที่ QC, และทีมนับสต็อก (Helper) 
              โดยผู้ใช้ที่เป็นแอดมินทั่วไปจะไม่สามารถเข้าถึงหน้าต่างจัดการสิทธิ์นี้ได้
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white text-xs font-bold rounded-xl flex items-center gap-2 transition-colors cursor-pointer border border-white/10"
              title="รีเฟรชข้อมูล"
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
              <span>{refreshing ? "กำลังโหลด..." : "รีเฟรช"}</span>
            </button>

            <button
              onClick={() => {
                setFormError(null);
                setFormEmail("");
                setFormName("");
                setFormRole("HELPER");
                setShowAddModal(true);
              }}
              className="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-black rounded-xl flex items-center gap-2 transition-colors cursor-pointer shadow-lg shadow-amber-500/20"
            >
              <UserPlus className="h-4 w-4" />
              <span>+ เพิ่ม / กำหนดสิทธิ์ใหม่</span>
            </button>
          </div>
        </div>

        {/* ROLE STATS METRIC PILLS */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-6 border-t border-white/10">
          <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-3 border border-white/10">
            <div className="flex items-center gap-2 text-slate-300 text-xs mb-1">
              <Users className="h-3.5 w-3.5 text-indigo-400" />
              <span>ผู้ใช้ทั้งหมด</span>
            </div>
            <div className="text-xl sm:text-2xl font-black text-white">{users.length} คน</div>
          </div>

          <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-3 border border-white/10">
            <div className="flex items-center gap-2 text-amber-300 text-xs mb-1">
              <Shield className="h-3.5 w-3.5 text-amber-400" />
              <span>แอดมินทั่วไป</span>
            </div>
            <div className="text-xl sm:text-2xl font-black text-amber-400">{adminCount} คน</div>
          </div>

          <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-3 border border-white/10">
            <div className="flex items-center gap-2 text-purple-300 text-xs mb-1">
              <UserCheck className="h-3.5 w-3.5 text-purple-400" />
              <span>เจ้าหน้าที่ QC</span>
            </div>
            <div className="text-xl sm:text-2xl font-black text-purple-400">{qcCount} คน</div>
          </div>

          <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-3 border border-white/10">
            <div className="flex items-center gap-2 text-emerald-300 text-xs mb-1">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
              <span>ทีมนับสต็อก (Helper)</span>
            </div>
            <div className="text-xl sm:text-2xl font-black text-emerald-400">{helperCount} คน</div>
          </div>
        </div>
      </div>

      {/* POLICY EXPLANATION BOX */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-indigo-50 text-indigo-700 rounded-xl shrink-0 mt-0.5">
            <Info className="h-5 w-5" />
          </div>
          <div className="text-xs text-slate-600 space-y-1.5">
            <h4 className="font-bold text-slate-900 text-sm">ข้อกำหนดและการทำงานของแต่ละสิทธิ์:</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                <div className="font-bold text-slate-900 flex items-center gap-1.5 mb-1 text-xs">
                  <span className="h-2 w-2 rounded-full bg-red-500"></span>
                  🛡️ แอดมิน (Admin)
                </div>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  จัดการตู้พัสดุ ปรับแต่งข้อมูลพัสดุ เพิ่มสต็อก พิมพ์ QR code และดูประวัติทุกชนิด <b>แต่จะไม่สามารถแก้ไขสิทธิ์ของผู้อื่นได้</b>
                </p>
              </div>

              <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                <div className="font-bold text-slate-900 flex items-center gap-1.5 mb-1 text-xs">
                  <span className="h-2 w-2 rounded-full bg-purple-500"></span>
                  🔬 เจ้าหน้าที่ QC
                </div>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  เข้าใช้งานหน้าเบิกใช้ QC ได้ทันที เพื่อเลือกตัดสต็อกวัสดุและบันทึกประวัติการเบิกใช้อัตโนมัติ
                </p>
              </div>

              <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                <div className="font-bold text-slate-900 flex items-center gap-1.5 mb-1 text-xs">
                  <span className="h-2 w-2 rounded-full bg-indigo-500"></span>
                  📋 ทีมนับสต็อก (Helper)
                </div>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  สแกนการ์ด QR ประจำตู้ผ่านมือถือหรือแท็บเล็ต เพื่อตรวจนับจำนวนคงเหลือจริงหน้างาน
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* SEARCH AND CONTROLS */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="ค้นหาด้วยอีเมล, ชื่อ, หรือสิทธิ์..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-xs transition-all"
          />
        </div>
        <div className="text-xs text-slate-500 font-medium">
          แสดง {filteredUsers.length} จาก {users.length} รายการ
        </div>
      </div>

      {/* USERS TABLE */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-400">
            <RefreshCw className="h-8 w-8 mx-auto animate-spin mb-3 text-indigo-500" />
            <p className="text-xs font-medium">กำลังโหลดรายชื่อผู้ใช้จากฐานข้อมูล...</p>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <Users className="h-10 w-10 mx-auto text-slate-300 mb-3" />
            <p className="text-sm font-bold text-slate-700">ไม่พบผู้ใช้งานที่ตรงกับคำค้นหา</p>
            <p className="text-xs text-slate-400 mt-1">ลองเปลี่ยนคำค้นหา หรือกดปุ่ม "+ เพิ่ม / กำหนดสิทธิ์ใหม่" ด้านบน</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50/80 text-[11px] uppercase tracking-wider text-slate-400 font-bold border-b border-slate-100">
                <tr>
                  <th className="px-6 py-4">ผู้ใช้งาน (User Profile)</th>
                  <th className="px-6 py-4">สถานะบทบาทปัจจุบัน</th>
                  <th className="px-6 py-4">เปลี่ยนระดับสิทธิ์</th>
                  <th className="px-6 py-4">ข้อมูลการมอบสิทธิ์</th>
                  <th className="px-6 py-4 text-right">จัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredUsers.map((user) => {
                  const isThisSuperAdmin = user.email.toLowerCase() === SUPER_ADMIN_EMAIL || user.isSuperAdmin;

                  return (
                    <tr 
                      key={user.id} 
                      className={`hover:bg-slate-50/60 transition-colors ${
                        isThisSuperAdmin ? "bg-amber-50/30" : ""
                      }`}
                    >
                      {/* USER PROFILE INFO */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className={`h-10 w-10 rounded-xl flex items-center justify-center font-bold text-sm shrink-0 shadow-xs ${
                            isThisSuperAdmin 
                              ? "bg-amber-500 text-white ring-2 ring-amber-300"
                              : user.role === "ADMIN"
                              ? "bg-red-100 text-red-700"
                              : user.role === "QC"
                              ? "bg-purple-100 text-purple-700"
                              : "bg-indigo-100 text-indigo-700"
                          }`}>
                            {isThisSuperAdmin ? (
                              <Crown className="h-5 w-5 text-amber-100" />
                            ) : (
                              user.name ? user.name.charAt(0).toUpperCase() : user.email.charAt(0).toUpperCase()
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-slate-900 text-sm block truncate max-w-[200px]">
                                {user.name || "ผู้ใช้งาน"}
                              </span>
                              {isThisSuperAdmin && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-900 border border-amber-300">
                                  <Crown className="h-3 w-3 text-amber-600" />
                                  Super Admin
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5 text-slate-400 text-xs mt-0.5">
                              <Mail className="h-3 w-3 shrink-0" />
                              <span className="font-mono text-[11px] truncate max-w-[220px]">{user.email}</span>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* CURRENT ROLE BADGE */}
                      <td className="px-6 py-4">
                        {isThisSuperAdmin ? (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-black text-xs bg-amber-100 text-amber-900 border border-amber-300 shadow-xs">
                            <Crown className="h-3.5 w-3.5 text-amber-600" />
                            ผู้ดูแลระบบสูงสุด
                          </span>
                        ) : user.role === "ADMIN" ? (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg font-bold text-xs bg-red-50 text-red-700 border border-red-200">
                            <Shield className="h-3.5 w-3.5" />
                            แอดมิน (Admin)
                          </span>
                        ) : user.role === "QC" ? (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg font-bold text-xs bg-purple-50 text-purple-700 border border-purple-200">
                            <UserCheck className="h-3.5 w-3.5" />
                            เจ้าหน้าที่ QC
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg font-bold text-xs bg-indigo-50 text-indigo-700 border border-indigo-200">
                            <ShieldCheck className="h-3.5 w-3.5" />
                            นับสต็อก (Helper)
                          </span>
                        )}
                      </td>

                      {/* ROLE SELECTOR / SWITCHER */}
                      <td className="px-6 py-4">
                        {isThisSuperAdmin ? (
                          <div className="text-[11px] text-amber-800/80 font-medium flex items-center gap-1 italic">
                            <Lock className="h-3 w-3 text-amber-600" />
                            สิทธิ์สูงสุดถาวร ไม่สามารถเปลี่ยนได้
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5">
                            <select
                              value={user.role}
                              onChange={(e) => handleRoleChange(user, e.target.value as UserRole)}
                              className="bg-white border border-slate-200 text-slate-800 text-xs font-semibold rounded-xl px-3 py-1.5 focus:ring-2 focus:ring-indigo-500 outline-none cursor-pointer hover:border-slate-300 transition-colors"
                            >
                              <option value="ADMIN">🛡️ แอดมิน (ADMIN)</option>
                              <option value="QC">🔬 เจ้าหน้าที่ QC (QC)</option>
                              <option value="HELPER">📋 นับสต็อก (HELPER)</option>
                            </select>
                          </div>
                        )}
                      </td>

                      {/* ASSIGNED BY & UPDATED AT */}
                      <td className="px-6 py-4">
                        <div className="text-[11px] text-slate-500">
                          <div>
                            ผู้มอบสิทธิ์: <span className="font-semibold text-slate-700">{user.assignedBy || "ระบบ"}</span>
                          </div>
                          {user.updatedAt && (
                            <div className="text-slate-400 text-[10px] mt-0.5 flex items-center gap-1">
                              <Calendar className="h-2.5 w-2.5" />
                              {new Date(user.updatedAt?.toDate?.() || user.updatedAt).toLocaleDateString("th-TH", {
                                year: "numeric",
                                month: "short",
                                day: "numeric"
                              })}
                            </div>
                          )}
                        </div>
                      </td>

                      {/* ACTIONS */}
                      <td className="px-6 py-4 text-right">
                        {isThisSuperAdmin ? (
                          <span className="text-[11px] text-slate-300">บัญชีหลัก</span>
                        ) : (
                          <button
                            onClick={() => setUserToDelete(user)}
                            className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer"
                            title="ลบสิทธิ์ผู้ใช้งาน"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ADD / PRE-ASSIGN USER MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-7 shadow-2xl border border-slate-100">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="h-9 w-9 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center">
                  <UserPlus className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">กำหนดสิทธิ์ผู้ใช้งานใหม่</h3>
                  <p className="text-[11px] text-slate-400">ระบุอีเมล Google ของเพื่อนร่วมงานและกำหนดสิทธิ์</p>
                </div>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {formError && (
              <div className="mt-4 p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleAddUserSubmit} className="space-y-4 mt-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  อีเมล Google ของผู้ใช้ <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                  <input
                    type="email"
                    required
                    placeholder="เช่น user.qc@company.com"
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                    className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-mono"
                  />
                </div>
                <p className="text-[10px] text-slate-400 mt-1">
                  ต้องเป็นอีเมลเดียวกับที่ผู้ใช้ใช้กด Sign in with Google เข้าสู่ระบบ
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  ชื่อผู้ใช้งาน / แผนก (ระบุหรือไม่ก็ได้)
                </label>
                <input
                  type="text"
                  placeholder="เช่น สมชาย ฝ่ายควบคุมคุณภาพ"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  ระดับสิทธิ์ที่ต้องการมอบหมาย <span className="text-rose-500">*</span>
                </label>
                <div className="grid grid-cols-1 gap-2">
                  <label className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                    formRole === "ADMIN" ? "border-red-500 bg-red-50/50 ring-1 ring-red-500" : "border-slate-200 hover:bg-slate-50"
                  }`}>
                    <div className="flex items-center gap-2.5">
                      <input
                        type="radio"
                        name="role"
                        value="ADMIN"
                        checked={formRole === "ADMIN"}
                        onChange={() => setFormRole("ADMIN")}
                        className="text-red-600 focus:ring-red-500"
                      />
                      <div>
                        <div className="font-bold text-xs text-slate-900">🛡️ แอดมิน (ADMIN)</div>
                        <div className="text-[10px] text-slate-500">จัดการตู้ คลังสินค้า พัสดุ (ไม่สามารถจัดการสิทธิ์ผู้ใช้อื่นได้)</div>
                      </div>
                    </div>
                  </label>

                  <label className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                    formRole === "QC" ? "border-purple-500 bg-purple-50/50 ring-1 ring-purple-500" : "border-slate-200 hover:bg-slate-50"
                  }`}>
                    <div className="flex items-center gap-2.5">
                      <input
                        type="radio"
                        name="role"
                        value="QC"
                        checked={formRole === "QC"}
                        onChange={() => setFormRole("QC")}
                        className="text-purple-600 focus:ring-purple-500"
                      />
                      <div>
                        <div className="font-bold text-xs text-slate-900">🔬 เจ้าหน้าที่ QC (QC)</div>
                        <div className="text-[10px] text-slate-500">สำหรับเบิกใช้พัสดุและตัดสต็อกในตู้แล็บ</div>
                      </div>
                    </div>
                  </label>

                  <label className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                    formRole === "HELPER" ? "border-indigo-500 bg-indigo-50/50 ring-1 ring-indigo-500" : "border-slate-200 hover:bg-slate-50"
                  }`}>
                    <div className="flex items-center gap-2.5">
                      <input
                        type="radio"
                        name="role"
                        value="HELPER"
                        checked={formRole === "HELPER"}
                        onChange={() => setFormRole("HELPER")}
                        className="text-indigo-600 focus:ring-indigo-500"
                      />
                      <div>
                        <div className="font-bold text-xs text-slate-900">📋 เจ้าหน้าที่นับสต็อก (HELPER)</div>
                        <div className="text-[10px] text-slate-500">สแกน QR ประจำตู้และนับตรวจเช็กสต็อก</div>
                      </div>
                    </div>
                  </label>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer shadow-md shadow-indigo-600/20"
                >
                  {submitting ? "กำลังบันทึก..." : "ยืนยันและบันทึกสิทธิ์"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {userToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-100 text-center">
            <div className="h-14 w-14 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <Trash2 className="h-7 w-7" />
            </div>
            <h3 className="text-base font-bold text-slate-900 mb-1">ยืนยันการลบสิทธิ์ผู้ใช้</h3>
            <p className="text-xs text-slate-500 mb-4 leading-relaxed">
              คุณแน่ใจหรือไม่ว่าต้องการลบสิทธิ์ของ <b>{userToDelete.email}</b> ออกจากระบบ? ผู้ใช้นี้จะถูกปรับกลับเป็นสิทธิ์เริ่มต้นเมื่อเข้าสู่ระบบใหม่
            </p>
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={() => setUserToDelete(null)}
                disabled={deleting}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                onClick={confirmDelete}
                disabled={deleting}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer shadow-md shadow-rose-600/20"
              >
                {deleting ? "กำลังลบ..." : "ยืนยันการลบ"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
