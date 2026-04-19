export type EmployeeRow = {
  id: number;
  name: string;
  dept: string;
  role: string;
  salary: number;
  progress: number;
  status: "active" | "inactive" | "pending";
  isVip: boolean;
  joined: string;
};

const NAMES = [
  "Nguyễn Văn An",
  "Trần Thị Bình",
  "Lê Minh Châu",
  "Phạm Quốc Dũng",
  "Hoàng Thị Én",
  "Đỗ Văn Phúc",
  "Bùi Thị Giang",
  "Vũ Hữu Hùng",
  "Ngô Thị Ích",
  "Đinh Văn Khoa",
  "Lý Thị Lan",
  "Trương Văn Mạnh",
  "Phan Thị Ngọc",
  "Cao Văn Ổn",
  "Dương Thị Phượng",
  "Hồ Văn Quân",
  "Võ Thị Rạng",
  "Đặng Văn Sơn",
  "Tô Thị Tuyết",
  "Mai Văn Uy",
  "Lưu Thị Vân",
  "Chu Văn Xuyên",
  "Quách Thị Yến",
  "Kiều Văn Zũng",
  "Mạc Thị Ánh",
] as const;

export const DEPTS = [
  "Kỹ thuật",
  "Marketing",
  "Kinh doanh",
  "Nhân sự",
  "Tài chính",
] as const;
export const ROLES = [
  "Nhân viên",
  "Trưởng nhóm",
  "Quản lý",
  "Giám đốc",
] as const;
export const STATUSES = ["active", "inactive", "pending"] as const;
export const allEmployees: EmployeeRow[] = Array.from(
  { length: 1000 },
  (_, index) => ({
    id: index + 1,
    name:
      NAMES[index % NAMES.length] +
      (index >= NAMES.length ? ` ${Math.floor(index / NAMES.length) + 2}` : ""),
    dept: DEPTS[index % DEPTS.length],
    role: ROLES[index % ROLES.length],
    salary: Math.round(((25 + Math.random() * 75) * 1e6) / 1e6) * 1e6,
    progress: Math.round(30 + Math.random() * 70),
    status: STATUSES[index % STATUSES.length],
    isVip: index % 7 === 0,
    joined: `${2019 + Math.floor(index / 20)}-${String((index % 12) + 1).padStart(2, "0")}-${String((index % 28) + 1).padStart(2, "0")}`,
  }),
);
