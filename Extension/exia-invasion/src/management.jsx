// ========== ExiaInvasion 管理页面组件 ==========
// 主要功能：账户管理、角色数据管理、装备统计配置等

import { useState, useEffect, useCallback, useMemo } from "react";
// ========== 导入依赖 ==========
import {
  AppBar,
  Toolbar,
  Typography,
  IconButton,
  Container,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  TextField,
  Switch,
  Box,
  Tabs,
  Tab,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Checkbox,
  List,
  ListItem,
  ListItemText,
  Snackbar,
  Alert,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import SaveIcon from "@mui/icons-material/Save";
import DeleteIcon from "@mui/icons-material/Delete";
import Visibility from "@mui/icons-material/Visibility";
import VisibilityOff from "@mui/icons-material/VisibilityOff";
import InputAdornment from "@mui/material/InputAdornment";
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import FileUploadIcon from '@mui/icons-material/FileUpload';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import TRANSLATIONS from "./translations.js";
import { v4 as uuidv4 } from "uuid";
import { getCharacters, setCharacters } from "./storage.js";

// ========== 常量定义 ==========
// 默认账户行数据结构

const defaultRow = () => ({
  id: uuidv4(),
  username: "",
  email: "",
  password: "",
  cookie: "",
  enabled: true
});

// 装备统计键名列表
const equipStatKeys = [
  "IncElementDmg",    // 属性伤害
  "StatAtk",          // 攻击力
  "StatAmmoLoad",     // 弹药装载
  "StatChargeTime",   // 充能时间
  "StatChargeDamage", // 充能伤害
  "StatCritical",     // 暴击率
  "StatCriticalDamage", // 暴击伤害
  "StatAccuracyCircle", // 精准度
  "StatDef"           // 防御力
];

// ========== 管理页面主组件 ==========

const ManagementPage = () => {
  // ========== 状态管理 ==========
  // 账户管理相关状态
  const [accounts, setAccounts] = useState([]);
  const [editing, setEditing] = useState([]);
  const [showPwds, setShowPwds] = useState([]);
  const [draggedItemIndex, setDraggedItemIndex] = useState(null); // 拖拽功能

  // 角色管理相关状态
  const [tab, setTab] = useState(0); // 0: 账户管理, 1: 角色管理
  const [characters, setCharactersData] = useState({ 
    elements: { 
      Electronic: [], 
      Fire: [], 
      Wind: [], 
      Water: [], 
      Iron: [], 
      Utility: [] 
    } 
  });
  const [nikkeList, setNikkeList] = useState([]);
  const [filterDialogOpen, setFilterDialogOpen] = useState(false);
  const [selectedElement, setSelectedElement] = useState("");
  const [filters, setFilters] = useState({
    name: "",
    class: "",
    element: "",
    use_burst_skill: "",
    corporation: "",
    weapon_type: "",
    original_rare: ""
  });
  const [filteredNikkes, setFilteredNikkes] = useState([]);
    // 角色拖拽状态
  const [draggedCharacterIndex, setDraggedCharacterIndex] = useState(null);
  const [draggedCharacterElement, setDraggedCharacterElement] = useState(null);
  const [snackbar, setSnackbar] = useState({ open: false, message: "", severity: "success" });
  
  // 全选/全不选状态
  const isAllEnabled = useMemo(() => accounts.every(acc => acc.enabled !== false), [accounts]);
  
  /* ========== 语言设置同步 ========== */
  const [lang, setLang] = useState("zh");
  const t = useCallback((k) => TRANSLATIONS[lang][k] || k, [lang]);
  
  useEffect(() => {
    chrome.storage.local.get("settings", (r) => {
      setLang(r.settings?.lang || "zh");
    });
    const handler = (c, area) => {
      if (area === "local" && c.settings) {
        setLang(c.settings.newValue?.lang || "zh");
      }
    };
    chrome.storage.onChanged.addListener(handler);
    return () => chrome.storage.onChanged.removeListener(handler);
  }, []);
  
  /* ========== 角色数据初始化 ========== */
  useEffect(() => {
    // 加载角色数据并处理数据迁移
    getCharacters().then(data => {
      // 检查是否需要从旧的对象格式迁移到新的数组格式
      const migratedData = { ...data };
      let needsMigration = false;
      
      // 检查每个属性并在需要时转换为数组格式
      ["Electronic", "Fire", "Wind", "Water", "Iron", "Utility"].forEach(element => {
        if (migratedData.elements[element] && !Array.isArray(migratedData.elements[element])) {
          // 将对象转换为数组
          const objectData = migratedData.elements[element];
          migratedData.elements[element] = Object.values(objectData);
          needsMigration = true;
        } else if (!migratedData.elements[element]) {
          // 确保所有属性都存在并为数组
          migratedData.elements[element] = [];
          needsMigration = true;
        }
        // 确保每个角色都有 showStats 属性
        migratedData.elements[element] = migratedData.elements[element].map(char => (
          char.showStats ? char : { ...char, showStats: [...equipStatKeys] }
        ));
      });
      
      // 如需要则保存迁移后的数据
      if (needsMigration) {
        setCharacters(migratedData);
      }
        setCharactersData(migratedData);
    });
    
    // 加载角色列表数据
    fetch(chrome.runtime.getURL("list.json"))
      .then(response => response.json())
      .then(data => setNikkeList(data.nikkes || []))
      .catch(err => console.error("Failed to load nikke list:", err));
  }, []);
  
  /* ========== 账号数据初始化 ========== */
  useEffect(() => {
    chrome.storage.local.get("accounts", async (r) => {
      let list = r.accounts || [];
      // 为没有 ID 的账号添加唯一标识符
      const updated = list.map(acc =>
        acc.id ? acc : { ...acc, id: uuidv4() }
      );
      if (JSON.stringify(updated) !== JSON.stringify(list)) {
        await new Promise(res => chrome.storage.local.set({ accounts: updated }, res));
      }
      list = updated;
      
      // 如果没有账号，创建默认空行
      if (list.length === 0) {
        setAccounts([defaultRow()]);
        setEditing([true]);
        setShowPwds([false]);
      } else {
        setAccounts(list);
        setEditing(Array(list.length).fill(false));
        setShowPwds(Array(list.length).fill(false));
      }
    });
  }, []);
  
  // 监听存储变化并同步状态
  useEffect(() => {
    const handler = (changes, area) => {
      if (area === "local" && changes.accounts) {
        const next = changes.accounts.newValue || [];
        setAccounts(next);
        setEditing((e) => (e.length === next.length ? e : Array(next.length).fill(false)));
        setShowPwds((s) => (s.length === next.length ? s : Array(next.length).fill(false)));
      }
    };
    chrome.storage.onChanged.addListener(handler);
    return () => chrome.storage.onChanged.removeListener(handler);
  }, []);
  
  // 持久化账号数据到存储
  const persist = (data) =>
    new Promise((ok) => chrome.storage.local.set({ accounts: data }, ok));
  
  /* ========== 账号管理操作函数 ========== */
  // 更新指定账号的字段值
  const updateField = (idx, field, value) =>
    setAccounts((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: value };
      return next;
    });
  
  // 添加新账号行
  const addRow = () => {
    const newRow = defaultRow();
    setAccounts((prev) => [...prev, newRow]);
    setEditing((prev) => [...prev, true]);
    setShowPwds((prev) => [...prev, false]);
  };
  
  // 开始编辑指定行
  const startEdit = (idx) =>
    setEditing((prev) => prev.map((e, i) => (i === idx ? true : e)));
  
  // 保存指定行的修改
  const saveRow = async (idx) => {
    setEditing((prev) => prev.map((e, i) => (i === idx ? false : e)));
    await persist(accounts);
  };
    // 删除指定行
  const deleteRow = async (idx) => {
    setAccounts((prev) => {
      const next = prev.filter((_, i) => i !== idx);
      persist(next);
      return next;
    });
    setEditing((prev) => prev.filter((_, i) => i !== idx));
    setShowPwds((prev) => prev.filter((_, i) => i !== idx));
  };
  
  // 全选/全不选启用状态
  const handleToggleAllEnabled = async () => {
    const newEnabledState = !isAllEnabled;
    const updatedAccounts = accounts.map(acc => ({
      ...acc,
      enabled: newEnabledState
    }));
    setAccounts(updatedAccounts);
    await persist(updatedAccounts);
  };
  
  // 渲染文本内容（空值显示占位符）
  const renderText = (txt) => (txt ? txt : "—");
  
  const iconUrl = useMemo(() => chrome.runtime.getURL("images/icon-128.png"), []);
  
  /* ---------- Drag and Drop Handlers ---------- */
  const handleDragStart = (e, index) => {
    setDraggedItemIndex(index);
    e.dataTransfer.setDragImage(new Image(), 0, 0);
  };
    const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };
  
  const handleDrop = (targetIndex) => {
    if (draggedItemIndex === null || draggedItemIndex === targetIndex) {
      setDraggedItemIndex(null);
      return;
    }
    
    const reorderedAccounts = [...accounts];
    const [draggedItem] = reorderedAccounts.splice(draggedItemIndex, 1);
    reorderedAccounts.splice(targetIndex, 0, draggedItem);
    
    const reorderedEditing = [...editing];
    const [draggedEditingState] = reorderedEditing.splice(draggedItemIndex, 1);
    reorderedEditing.splice(targetIndex, 0, draggedEditingState);
    
    const reorderedShowPwds = [...showPwds];
    const [draggedShowPwdState] = reorderedShowPwds.splice(draggedItemIndex, 1);
    reorderedShowPwds.splice(targetIndex, 0, draggedShowPwdState);
    
    setAccounts(reorderedAccounts);
    setEditing(reorderedEditing);
    setShowPwds(reorderedShowPwds);
    persist(reorderedAccounts);
    
    setDraggedItemIndex(null);  };  /* ---------- 角色管理工具函数 ---------- */
  const elementMapping = {
    "Electronic": "电击",
    "Fire": "燃烧", 
    "Wind": "风压",
    "Water": "水冷",
    "Iron": "铁甲",
    "Utility": "辅助"
  };
  
  const classMapping = {
    "Attacker": "火力型",
    "Defender": "防御型",
    "Supporter": "支援型"
  };
  
const corporationMapping = {
    "ELYSION": "极乐净土",
    "MISSILIS": "米西利斯",
    "TETRA": "泰特拉",
    "PILGRIM": "朝圣者",
    "ABNORMAL": "反常"
  };

  const equipStatLabels = [
    t("elementAdvantage"),
    t("attack"),
    t("ammo"),
    t("chargeSpeed"),
    t("chargeDamage"),
    t("critical"),
    t("criticalDamage"),
    t("hit"),
    t("defense")
  ];
  
  const getElementName = (element) => {
    return lang === "zh" ? (elementMapping[element] || element) : element;
  };
  
  const getClassName = (className) => {
    return lang === "zh" ? (classMapping[className] || className) : className;
  };
  
  const getCorporationName = (corporation) => {
    return lang === "zh" ? (corporationMapping[corporation] || corporation) : corporation;
  };  const openFilterDialog = (element) => {
    setSelectedElement(element);
    // Auto-set element filter if not Utility
    const initialFilters = {
      name: "",
      class: "",
      element: element !== "Utility" ? element : "",
      use_burst_skill: "",
      corporation: "",
      weapon_type: "",
      original_rare: ""
    };
    setFilters(initialFilters);
    
    // Apply initial filters immediately
    let filtered = nikkeList;
    if (element !== "Utility") {
      filtered = filtered.filter(nikke => nikke.element === element);
    }
    setFilteredNikkes(filtered);
    
    setFilterDialogOpen(true);
  };  const applyFilters = useCallback(() => {
    let filtered = nikkeList;
    
    Object.entries(filters).forEach(([key, value]) => {
      if (value) {
        if (key === "name") {
          // Search in both Chinese and English names
          const searchTerm = value.toLowerCase();
          filtered = filtered.filter(nikke => 
            (nikke.name_cn && nikke.name_cn.toLowerCase().includes(searchTerm)) ||
            (nikke.name_en && nikke.name_en.toLowerCase().includes(searchTerm))
          );        } else if (key === "use_burst_skill") {
          // Handle burst skill mapping: "1" -> "Step1", "2" -> "Step2", "3" -> "Step3"
          const burstMapping = {
            "1": "Step1",
            "2": "Step2", 
            "3": "Step3"
          };
          const mappedValue = burstMapping[value] || value;
          // "AllStep" 角色应该能被所有 Step 筛选条件匹配到
          filtered = filtered.filter(nikke => 
            nikke[key] === mappedValue || nikke[key] === "AllStep"
          );
        } else {
          filtered = filtered.filter(nikke => nikke[key] === value);
        }
      }
    });
    
    setFilteredNikkes(filtered);
  }, [nikkeList, filters]);const addCharacterToElement = (nikke) => {
    const newCharacters = {
      ...characters,
      elements: {
        ...characters.elements,
        [selectedElement]: [
          ...characters.elements[selectedElement],
          {
            name_code: nikke.name_code,
            id: nikke.id,
            name_cn: nikke.name_cn,
            name_en: nikke.name_en,
            priority: "yellow",
            showStats: [...equipStatKeys]
          }
        ]
      }
    };
    
    setCharactersData(newCharacters);
    setCharacters(newCharacters);
    setFilterDialogOpen(false);
  };  const updateCharacterPriority = (element, characterIndex, priority) => {
    const newCharacters = {
      ...characters,
      elements: {
        ...characters.elements,
        [element]: characters.elements[element].map((char, index) => 
          index === characterIndex ? { ...char, priority } : char
        )
      }
    };
    
    setCharactersData(newCharacters);
    setCharacters(newCharacters);
  };

  const updateCharacterShowStats = (element, characterIndex, stats) => {
    const newCharacters = {
      ...characters,
      elements: {
        ...characters.elements,
        [element]: characters.elements[element].map((char, index) =>
          index === characterIndex ? { ...char, showStats: stats } : char
        )
      }
    };

    setCharactersData(newCharacters);
    setCharacters(newCharacters);
  };
  
  const deleteCharacter = (element, characterIndex) => {
    const newCharacters = {
      ...characters,
      elements: {
        ...characters.elements,
        [element]: characters.elements[element].filter((_, index) => index !== characterIndex)
      }
    };
    
    setCharactersData(newCharacters);
    setCharacters(newCharacters);
  };
    const getPriorityColor = (priority) => {
    switch (priority) {
      case "black": return { backgroundColor: "#000", color: "#fff" };
      case "blue": return { backgroundColor: "#2196f3", color: "#fff" };
      case "yellow": return { backgroundColor: "#ffeb3b", color: "#000" };
      default: return { backgroundColor: "#e0e0e0", color: "#000" };
    }
  };

  /* ---------- Character Drag and Drop Handlers ---------- */
  const handleCharacterDragStart = (e, element, index) => {
    setDraggedCharacterIndex(index);
    setDraggedCharacterElement(element);
    e.dataTransfer.setDragImage(new Image(), 0, 0);
  };
  const handleCharacterDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleCharacterDrop = (targetElement, targetIndex) => {
    if (draggedCharacterIndex === null || draggedCharacterElement === null) {
      return;
    }

    // If dropping in the same element at the same position, do nothing
    if (draggedCharacterElement === targetElement && draggedCharacterIndex === targetIndex) {
      setDraggedCharacterIndex(null);
      setDraggedCharacterElement(null);
      return;
    }

    const newCharacters = { ...characters };
    
    // Remove character from source element
    const [draggedCharacter] = newCharacters.elements[draggedCharacterElement].splice(draggedCharacterIndex, 1);
    
    // Add character to target element
    newCharacters.elements[targetElement].splice(targetIndex, 0, draggedCharacter);
    
    setCharactersData(newCharacters);
    setCharacters(newCharacters);
    
    setDraggedCharacterIndex(null);
    setDraggedCharacterElement(null);
  };
  
  /* ---------- Import/Export Handlers ---------- */
  const handleExport = () => {
    const dataStr = JSON.stringify(characters, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "characters.json";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleImport = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const importedData = JSON.parse(e.target.result);
        // Basic validation
        if (importedData && importedData.elements && typeof importedData.elements === 'object') {
          setCharactersData(importedData);
          setCharacters(importedData);
          setSnackbar({ open: true, message: t("importSuccess"), severity: "success" });
        } else {
          throw new Error("Invalid file format");
        }
      } catch (error) {
        console.error("Import failed:", error);
        setSnackbar({ open: true, message: t("importError"), severity: "error" });
      }
    };
    reader.readAsText(file);
    // Reset file input
    event.target.value = null;
  };

  const triggerImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = handleImport;
    input.click();
  };

  useEffect(() => {
    applyFilters();
  }, [applyFilters]);
    /* ---------- 渲染 ---------- */
  return (
    <>
      <AppBar position="sticky" sx={{ top: 0, zIndex: (theme) => theme.zIndex.appBar }}>
        <Toolbar>
          <img
            src={iconUrl}
            alt="logo"
            style={{ width: 32, height: 32, marginRight: 8 }}
          />
          <Typography variant="h6">ExiaInvasion</Typography>
        </Toolbar>
      </AppBar>
      
      <Container sx={{ mt: 4, pb: 8 }}>
        <Tabs value={tab} onChange={(e, newTab) => setTab(newTab)} sx={{ mb: 3 }}>
          <Tab label={t("accountTable")} />
          <Tab label={t("characterManagement")} />
        </Tabs>
          {tab === 0 && (
          <>
            {/* 账户管理标题和启用全部按钮 */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6">
                {t("accountTable")}
              </Typography>
              <Button
                size="small"
                variant="outlined"
                onClick={handleToggleAllEnabled}
                sx={{ minWidth: 80 }}
              >
                {isAllEnabled ? t("deselectAll") : t("selectAll")}
              </Button>
            </Box>
            
            {/* Account management table */}
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell width="3%" sx={{ textAlign: 'center', paddingLeft: '2px', paddingRight: '2px' }}>
                    {/* Drag handle header */}
                  </TableCell>
                  <TableCell width="5%">{t("no")}</TableCell>
                  <TableCell width="5%">{t("enabled")}</TableCell>
                  <TableCell width="15%">{t("username")}</TableCell>
                  <TableCell width="20%">{t("email")}</TableCell>
                  <TableCell width="15%">{t("password")}</TableCell>
                  <TableCell width="20%">{t("cookie")}</TableCell>
                  <TableCell width="15%" align="right" />
                </TableRow>
              </TableHead>
              
              <TableBody>
                {accounts.map((row, idx) => {
                  const isEdit = editing[idx];
                  return (
                    <TableRow
                      key={row.id}
                      draggable={!isEdit}
                      onDragStart={(e) => handleDragStart(e, idx)}
                      onDragOver={handleDragOver}
                      onDrop={() => handleDrop(idx)}                      sx={{
                        "& > *": { verticalAlign: "top" },
                        cursor: !isEdit ? "grab" : "default",
                        opacity: draggedItemIndex === idx ? 0.7 : 1,
                        transform: draggedItemIndex === idx ? 'translateY(-4px)' : 'translateY(0)',
                        transition: 'all 0.2s ease',
                        backgroundColor: draggedItemIndex !== null && draggedItemIndex !== idx && !isEdit ? 'action.hover' : 'inherit',
                        '&:hover': {
                          backgroundColor: !isEdit && draggedItemIndex === null ? 'action.hover' : 'inherit',
                          transform: !isEdit && draggedItemIndex === null ? 'translateY(-2px)' : 'translateY(0)',
                          boxShadow: !isEdit && draggedItemIndex === null ? '0 2px 8px rgba(0,0,0,0.1)' : 'none',
                        },
                        '&:active': {
                          cursor: !isEdit ? 'grabbing' : 'default',
                          transform: !isEdit ? 'translateY(-4px)' : 'translateY(0)',
                        }
                      }}
                    >                      <TableCell sx={{ textAlign: 'center', cursor: !isEdit ? 'grab' : 'default', paddingLeft: '2px', paddingRight: '2px' }}>
                        {!isEdit && <DragIndicatorIcon fontSize="small" />}
                      </TableCell>
                      <TableCell>{idx + 1}</TableCell>
                      <TableCell>
                        <Switch
                          size="small"
                          checked={row.enabled !== false}
                          onChange={() => {
                            const nextAccounts = accounts.map((r, i) =>
                              i === idx ? { ...r, enabled: !r.enabled } : r
                            );
                            setAccounts(nextAccounts);
                            persist(nextAccounts);
                          }}
                          disabled={isEdit}
                        />
                      </TableCell>
                      <TableCell>
                        {isEdit ? (
                          <TextField
                            variant="standard"
                            value={row.username}
                            onChange={(e) => updateField(idx, "username", e.target.value)}
                            fullWidth
                          />
                        ) : (
                          renderText(row.username)
                        )}
                      </TableCell>
                      <TableCell>
                        {isEdit ? (
                          <TextField
                            variant="standard"
                            value={row.email}
                            onChange={(e) => updateField(idx, "email", e.target.value)}
                            fullWidth
                          />
                        ) : (
                          renderText(row.email)
                        )}
                      </TableCell>
                      <TableCell>
                        {isEdit ? (
                          <TextField
                            variant="standard"
                            type={showPwds[idx] ? "text" : "password"}
                            value={row.password}
                            onChange={(e) => updateField(idx, "password", e.target.value)}
                            fullWidth
                            slotProps={{
                              input: {
                                endAdornment: (
                                  <InputAdornment position="end">
                                    <IconButton
                                      size="small"
                                      onClick={() =>
                                        setShowPwds((v) => v.map((f, i) => (i === idx ? !f : f)))
                                      }
                                      edge="end"
                                    >
                                      {showPwds[idx] ? <VisibilityOff /> : <Visibility />}
                                    </IconButton>
                                  </InputAdornment>
                                ),
                              },
                            }}
                          />
                        ) : row.password ? (
                          "••••••"
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell>
                        {isEdit ? (
                          <TextField
                            variant="standard"
                            multiline
                            maxRows={3}
                            value={row.cookie}
                            onChange={(e) => updateField(idx, "cookie", e.target.value)}
                            fullWidth
                          />
                        ) : row.cookie ? (
                          t("saved")
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell align="right">
                        <Box display="flex" flexDirection="row" justifyContent="flex-end">
                          {isEdit ? (
                            <IconButton
                              color="primary"
                              onClick={() => saveRow(idx)}
                              size="small"
                            >
                              <SaveIcon />
                            </IconButton>
                          ) : (
                            <IconButton onClick={() => startEdit(idx)} size="small">
                              <EditIcon />
                            </IconButton>
                          )}
                          <IconButton
                            color="error"
                            onClick={() => deleteRow(idx)}
                            sx={{ ml: 0.5 }}
                            size="small"
                            disabled={isEdit}
                          >
                            <DeleteIcon />
                          </IconButton>
                        </Box>
                      </TableCell>
                    </TableRow>
                  );
                })}
                
                <TableRow>
                  <TableCell colSpan={8} sx={{ pt: 2, borderBottom: 'none' }}>
                    <Box display="flex" justifyContent="center">
                      <IconButton color="primary" onClick={addRow}>
                        <AddIcon />
                      </IconButton>
                    </Box>
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </>
        )}
          {tab === 1 && (
          <>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6">
                {t("characterManagement")}
              </Typography>
              <Box>
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<FileUploadIcon />}
                  onClick={triggerImport}
                  sx={{ mr: 1 }}
                >
                  {t("importCharacters")}
                </Button>
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<FileDownloadIcon />}
                  onClick={handleExport}
                >
                  {t("exportCharacters")}
                </Button>
              </Box>
            </Box>
              {["Electronic", "Fire", "Wind", "Water", "Iron", "Utility"].map((element) => {
              const elementChars = characters.elements[element] || [];
              return (
                <Box key={element} sx={{ mb: 3, border: '1px solid #e0e0e0', borderRadius: 1, p: 2 }}>
                  <Typography variant="h6" sx={{ mb: 2 }}>
                    {getElementName(element)} ({elementChars.length})
                  </Typography>
                  <Box display="flex" flexDirection="column" gap={1}>
                    {/* Character Table */}
                    <Table size="small">                      <TableHead>
                        <TableRow>
                          <TableCell width="3%" sx={{ textAlign: 'center', paddingLeft: '2px', paddingRight: '2px' }}>
                            {/* Drag handle header */}
                          </TableCell>
                          <TableCell width="5%">{t("no")}</TableCell>
                          <TableCell width="20%">{t("characterName")}</TableCell>
                          <TableCell width="10%">{t("priority")}</TableCell>
                          {/* 装备词条列标题 */}
                          {equipStatKeys.map((key, idx) => (
                            <TableCell key={key} width="6%" sx={{ textAlign: 'center', fontSize: '0.75rem' }}>
                              {equipStatLabels[idx]}
                            </TableCell>
                          ))}
                          <TableCell width="6%" align="right"></TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {elementChars.map((charData, index) => (
                          <TableRow
                            key={`${charData.id}-${index}`}
                            draggable
                            onDragStart={(e) => handleCharacterDragStart(e, element, index)}
                            onDragOver={handleCharacterDragOver}
                            onDrop={() => handleCharacterDrop(element, index)}
                            sx={{
                              "& > *": { verticalAlign: "top" },
                              cursor: "grab",
                              opacity: draggedCharacterIndex === index && draggedCharacterElement === element ? 0.7 : 1,
                              transform: draggedCharacterIndex === index && draggedCharacterElement === element ? 'translateY(-4px)' : 'translateY(0)',
                              transition: 'all 0.2s ease',
                              backgroundColor: draggedCharacterIndex !== null && (draggedCharacterIndex !== index || draggedCharacterElement !== element) ? 'action.hover' : 'inherit',
                              '&:hover': {
                                backgroundColor: draggedCharacterIndex === null ? 'action.hover' : 'inherit',
                                transform: draggedCharacterIndex === null ? 'translateY(-2px)' : 'translateY(0)',
                                boxShadow: draggedCharacterIndex === null ? '0 2px 8px rgba(0,0,0,0.1)' : 'none',
                              },
                              '&:active': {
                                cursor: 'grabbing',
                                transform: 'translateY(-4px)',
                              }
                            }}
                          >
                            <TableCell sx={{ textAlign: 'center', cursor: 'grab', paddingLeft: '2px', paddingRight: '2px' }}>
                              <DragIndicatorIcon fontSize="small" />
                            </TableCell>
                            <TableCell>{index + 1}</TableCell>
                            <TableCell>
                              <Typography variant="body2">
                                {lang === "zh" ? charData.name_cn : charData.name_en}
                              </Typography>
                            </TableCell>                            <TableCell>
                              <FormControl size="small" sx={{ minWidth: 100 }}>
                                <Select
                                  value={charData.priority}
                                  onChange={(e) => updateCharacterPriority(element, index, e.target.value)}
                                  sx={getPriorityColor(charData.priority)}
                                  MenuProps={{
                                    PaperProps: {
                                      style: {
                                        maxHeight: 200,
                                        width: 'auto',
                                      },
                                    },
                                    anchorOrigin: {
                                      vertical: 'bottom',
                                      horizontal: 'left',
                                    },
                                    transformOrigin: {
                                      vertical: 'top',
                                      horizontal: 'left',
                                    },
                                  }}
                                >
                                  <MenuItem value="black" sx={getPriorityColor("black")}>{t("black")}</MenuItem>
                                  <MenuItem value="blue" sx={getPriorityColor("blue")}>{t("blue")}</MenuItem>
                                  <MenuItem value="yellow" sx={getPriorityColor("yellow")}>{t("yellow")}</MenuItem>
                                </Select>
                              </FormControl>
                            </TableCell>
                            {/* 装备词条复选框 */}
                            {equipStatKeys.map((key) => (
                              <TableCell key={key} sx={{ textAlign: 'center', padding: '4px' }}>
                                <Checkbox
                                  size="small"
                                  checked={charData.showStats.includes(key)}
                                  onChange={(e) => {
                                    const newStats = e.target.checked
                                      ? [...charData.showStats, key]
                                      : charData.showStats.filter(stat => stat !== key);
                                    updateCharacterShowStats(element, index, newStats);
                                  }}
                                />
                              </TableCell>
                            ))}
                            <TableCell align="right">
                              <IconButton
                                color="error"
                                onClick={() => deleteCharacter(element, index)}
                                size="small"
                              >
                                <DeleteIcon />
                              </IconButton>
                            </TableCell>
                          </TableRow>
                        ))}                        <TableRow>
                          <TableCell colSpan={4 + equipStatKeys.length + 1} sx={{ pt: 2, borderBottom: 'none' }}>
                            <Box display="flex" justifyContent="center">
                              <IconButton color="primary" onClick={() => openFilterDialog(element)}>
                                <AddIcon />
                              </IconButton>
                            </Box>
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </Box>
                </Box>
              );
            })}
          </>
        )}
      </Container>
      
      {/* Character Filter Dialog */}
      <Dialog open={filterDialogOpen} onClose={() => setFilterDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>{t("characterFilter")}</DialogTitle>
        <DialogContent>          <Box display="flex" flexDirection="column" gap={2} sx={{ mt: 1 }}>
            {/* Name search input */}            <TextField
              size="small"
              label={t("characterName")}
              value={filters.name}
              onChange={(e) => setFilters(prev => ({ ...prev, name: e.target.value }))}
              placeholder={t("searchPlaceholder")}
              fullWidth
            />            <Box display="flex" gap={2} flexWrap="wrap">
              <FormControl size="small" sx={{ minWidth: 120 }}>
                <InputLabel>{t("class")}</InputLabel>
                <Select
                  value={filters.class}
                  onChange={(e) => setFilters(prev => ({ ...prev, class: e.target.value }))}
                  label={t("class")}
                  MenuProps={{
                    PaperProps: {
                      style: { maxHeight: 200, width: 'auto' }
                    },
                    anchorOrigin: { vertical: 'bottom', horizontal: 'left' },
                    transformOrigin: { vertical: 'top', horizontal: 'left' }
                  }}
                >
                  <MenuItem value="">All</MenuItem>
                  <MenuItem value="Attacker">{t("attacker")}</MenuItem>
                  <MenuItem value="Defender">{t("defender")}</MenuItem>
                  <MenuItem value="Supporter">{t("supporter")}</MenuItem>
                </Select>
              </FormControl>
              
              <FormControl size="small" sx={{ minWidth: 120 }}>
                <InputLabel>{t("element")}</InputLabel>
                <Select
                  value={filters.element}
                  onChange={(e) => setFilters(prev => ({ ...prev, element: e.target.value }))}
                  label={t("element")}
                  MenuProps={{
                    PaperProps: {
                      style: { maxHeight: 200, width: 'auto' }
                    },
                    anchorOrigin: { vertical: 'bottom', horizontal: 'left' },
                    transformOrigin: { vertical: 'top', horizontal: 'left' }
                  }}
                >
                  <MenuItem value="">All</MenuItem>
                  <MenuItem value="Iron">{t("iron")}</MenuItem>
                  <MenuItem value="Fire">{t("fire")}</MenuItem>
                  <MenuItem value="Water">{t("water")}</MenuItem>
                  <MenuItem value="Wind">{t("wind")}</MenuItem>
                  <MenuItem value="Electronic">{t("electronic")}</MenuItem>
                </Select>
              </FormControl>
              
              <FormControl size="small" sx={{ minWidth: 120 }}>
                <InputLabel>{t("burstSkill")}</InputLabel>
                <Select
                  value={filters.use_burst_skill}
                  onChange={(e) => setFilters(prev => ({ ...prev, use_burst_skill: e.target.value }))}
                  label={t("burstSkill")}
                  MenuProps={{
                    PaperProps: {
                      style: { maxHeight: 200, width: 'auto' }
                    },
                    anchorOrigin: { vertical: 'bottom', horizontal: 'left' },
                    transformOrigin: { vertical: 'top', horizontal: 'left' }
                  }}
                >
                  <MenuItem value="">All</MenuItem>
                  <MenuItem value="1">1</MenuItem>
                  <MenuItem value="2">2</MenuItem>
                  <MenuItem value="3">3</MenuItem>
                </Select>
              </FormControl>
              
              <FormControl size="small" sx={{ minWidth: 120 }}>
                <InputLabel>{t("corporation")}</InputLabel>
                <Select
                  value={filters.corporation}
                  onChange={(e) => setFilters(prev => ({ ...prev, corporation: e.target.value }))}
                  label={t("corporation")}
                  MenuProps={{
                    PaperProps: {
                      style: { maxHeight: 200, width: 'auto' }
                    },
                    anchorOrigin: { vertical: 'bottom', horizontal: 'left' },
                    transformOrigin: { vertical: 'top', horizontal: 'left' }
                  }}
                >
                  <MenuItem value="">All</MenuItem>
                  <MenuItem value="ELYSION">{t("elysion")}</MenuItem>
                  <MenuItem value="MISSILIS">{t("missilis")}</MenuItem>
                  <MenuItem value="TETRA">{t("tetra")}</MenuItem>
                  <MenuItem value="PILGRIM">{t("pilgrim")}</MenuItem>
                  <MenuItem value="ABNORMAL">{t("abnormal")}</MenuItem>
                </Select>
              </FormControl>
              
              <FormControl size="small" sx={{ minWidth: 120 }}>
                <InputLabel>{t("weaponType")}</InputLabel>
                <Select
                  value={filters.weapon_type}
                  onChange={(e) => setFilters(prev => ({ ...prev, weapon_type: e.target.value }))}
                  label={t("weaponType")}
                  MenuProps={{
                    PaperProps: {
                      style: { maxHeight: 200, width: 'auto' }
                    },
                    anchorOrigin: { vertical: 'bottom', horizontal: 'left' },
                    transformOrigin: { vertical: 'top', horizontal: 'left' }
                  }}
                >
                  <MenuItem value="">All</MenuItem>
                  <MenuItem value="AR">AR</MenuItem>
                  <MenuItem value="SMG">SMG</MenuItem>
                  <MenuItem value="SG">SG</MenuItem>
                  <MenuItem value="SR">SR</MenuItem>
                  <MenuItem value="MG">MG</MenuItem>
                  <MenuItem value="RL">RL</MenuItem>
                </Select>
              </FormControl>
              
              <FormControl size="small" sx={{ minWidth: 120 }}>
                <InputLabel>{t("rarity")}</InputLabel>
                <Select
                  value={filters.original_rare}
                  onChange={(e) => setFilters(prev => ({ ...prev, original_rare: e.target.value }))}
                  label={t("rarity")}
                  MenuProps={{
                    PaperProps: {
                      style: { maxHeight: 200, width: 'auto' }
                    },
                    anchorOrigin: { vertical: 'bottom', horizontal: 'left' },
                    transformOrigin: { vertical: 'top', horizontal: 'left' }
                  }}
                >
                  <MenuItem value="">All</MenuItem>
                  <MenuItem value="SSR">SSR</MenuItem>
                  <MenuItem value="SR">SR</MenuItem>
                  <MenuItem value="R">R</MenuItem>
                </Select>
              </FormControl>
            </Box>
            
            <Typography variant="subtitle2">{t("filterResults")} ({filteredNikkes.length})</Typography>
            
            <Box sx={{ maxHeight: 400, overflow: 'auto' }}>              
              {filteredNikkes.length > 0 ? (
                <List>
                  {filteredNikkes.map((nikke) => (
                    <ListItem 
                      key={nikke.id}
                      secondaryAction={
                        <Button
                          variant="contained"
                          size="small"
                          onClick={() => addCharacterToElement(nikke)}
                        >
                          {t("confirmAdd")}
                        </Button>
                      }
                    >
                      <ListItemText
                        primary={lang === "zh" ? nikke.name_cn : nikke.name_en}
                        secondary={`${getClassName(nikke.class)} | ${getElementName(nikke.element)} | ${getCorporationName(nikke.corporation)} | ${nikke.weapon_type} | ${nikke.original_rare}`}
                      />
                    </ListItem>
                  ))}
                </List>
              ) : (
                <Typography color="textSecondary">{t("noResults")}</Typography>
              )}
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setFilterDialogOpen(false)}>{t("cancel")}</Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          severity={snackbar.severity}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </>
  );
};

export default ManagementPage;