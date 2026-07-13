import React, { useState, useEffect } from "react";
import { 
  Menu, 
  TriangleAlert, 
  Maximize2, 
  Minimize2, 
  Sun, 
  Moon, 
  Wifi, 
  WifiOff, 
  RefreshCw,
  Clock,
  LayoutDashboard,
  ShoppingCart,
  Package,
  History,
  Settings,
  Laptop
} from "lucide-react";
import { Tenant } from "../../types";

interface HeaderProps {
  activeSection: string;
  isOnline: boolean;
  onToggleNetwork: () => void;
  activeTenant: Tenant;
  offlineQueueCount: number;
  onTriggerSync: () => void;
  isSyncing: boolean;
  onMobileMenuToggle: () => void;
  isDarkMode: boolean;
  onToggleDarkMode: () => void;
}

export default function Header({
  activeSection,
  isOnline,
  onToggleNetwork,
  activeTenant,
  offlineQueueCount,
  onTriggerSync,
  isSyncing,
  onMobileMenuToggle,
  isDarkMode,
  onToggleDarkMode
}: HeaderProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Fullscreen implementation
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => {
        setIsFullscreen(true);
      }).catch((err) => {
        console.error("Error enabling fullscreen", err);
      });
    } else {
      document.exitFullscreen().then(() => {
        setIsFullscreen(false);
      });
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  // Format breadcrumbs based on section
  const getBreadcrumb = () => {
    const items = [{ label: "NxtGen POS", icon: <TriangleAlert className="w-3.5 h-3.5" /> }];
    
    switch (activeSection) {
      case "home":
        items.push({ label: "Dashboard", icon: <LayoutDashboard className="w-3.5 h-3.5" /> });
        break;
      case "orders":
        items.push({ label: "Register Orders", icon: <ShoppingCart className="w-3.5 h-3.5" /> });
        break;
      case "products":
        items.push({ label: "Inventory Products", icon: <Package className="w-3.5 h-3.5" /> });
        break;
      case "records":
        items.push({ label: "Sync Records Logs", icon: <History className="w-3.5 h-3.5" /> });
        break;
      case "settings":
        items.push({ label: "Merchant Settings", icon: <Settings className="w-3.5 h-3.5" /> });
        break;
    }
    return items;
  };

  const breadcrumbs = getBreadcrumb();

  return (
    <header className="flex h-15 items-center justify-between border-b border-[#024959] bg-[#0D0D0D]/90 backdrop-blur-md px-4 lg:px-6 shrink-0 z-30 sticky top-0">
      
      {/* Left section: Hamburger (mobile) + Breadcrumbs */}
      <div className="flex items-center gap-3">
        {/* Mobile Menu Button */}
        <button
          onClick={onMobileMenuToggle}
          className="lg:hidden p-1.5 rounded-lg border border-[#024959] text-slate-300 hover:text-white bg-[#0D0D0D]/50 hover:bg-[#024959]/20 transition-all shrink-0 cursor-pointer"
        >
          <Menu className="w-4.5 h-4.5" />
          <span className="sr-only">Toggle Sidebar</span>
        </button>

        {/* Custom Bradcrumb */}
        <nav className="flex items-center gap-1.5 sm:gap-2.5 font-mono text-[10px] text-slate-400">
          {breadcrumbs.map((crumb, idx) => {
            const isLast = idx === breadcrumbs.length - 1;
            return (
              <React.Fragment key={idx}>
                {idx > 0 && <span className="text-slate-600">/</span>}
                <div className={`flex items-center gap-1.5 ${isLast ? "text-white font-bold" : "text-slate-400"}`}>
                  <span className={isLast ? "text-[#89D9C2] glow-text-mint animate-pulse" : "text-slate-500"}>
                    {crumb.icon}
                  </span>
                  <span className="hidden xs:inline">{crumb.label}</span>
                </div>
              </React.Fragment>
            );
          })}
        </nav>
      </div>

      {/* Right section: Widgets & Buttons */}
      <div className="flex items-center gap-2 sm:gap-3.5 font-mono text-[10px]">
        
        {/* Network status ticker */}
        <button
          onClick={onToggleNetwork}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border transition-all cursor-pointer ${
            isOnline 
              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20" 
              : "bg-amber-500/10 border-amber-500/30 text-amber-400 hover:bg-amber-500/20 animate-pulse"
          }`}
          title="Toggle network state simulation"
        >
          {isOnline ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
          <span className="hidden md:inline font-bold uppercase tracking-wider">{isOnline ? "ONLINE" : "OFFLINE"}</span>
        </button>

        {/* Sync trigger button */}
        {offlineQueueCount > 0 && (
          <button
            onClick={onTriggerSync}
            disabled={isSyncing || !isOnline}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border cursor-pointer ${
              !isOnline 
                ? "bg-slate-800/50 border-slate-700 text-slate-500 cursor-not-allowed" 
                : "bg-amber-500 text-[#010326] border-amber-400 hover:bg-amber-400 font-bold"
            }`}
            title="Flush local buffered queue to Postgres database"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? "animate-spin" : ""}`} />
            <span>SYNC ({offlineQueueCount})</span>
          </button>
        )}

        {/* Divider */}
        <div className="h-6 w-px bg-[#024959]/30 hidden sm:block"></div>

        {/* Fullscreen Button */}
        <button
          onClick={toggleFullscreen}
          className="p-1.5 bg-[#0d0d0d] hover:bg-[#024959]/20 border border-[#024959] rounded-lg text-slate-300 hover:text-white transition-all cursor-pointer"
          title="Toggle Fullscreen Mode"
        >
          {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
        </button>

        {/* Real-time Theme Toggle */}
        <button
          onClick={onToggleDarkMode}
          className="p-1.5 bg-[#0d0d0d] hover:bg-[#024959]/20 border border-[#024959] rounded-lg text-slate-300 hover:text-white transition-all cursor-pointer"
          title="Toggle High-Contrast Theme"
        >
          {isDarkMode ? <Moon className="w-3.5 h-3.5 text-[#208C8C]" /> : <Sun className="w-3.5 h-3.5 text-amber-400" />}
        </button>

        {/* Status indicator block */}
        <div className="bg-[#024959]/20 border border-[#208C8C]/30 px-2 py-0.5 rounded text-[8px] font-bold text-[#89D9C2] hidden xs:block">
          {activeTenant.currency} • V{activeTenant.taxRate * 100}%
        </div>
      </div>
    </header>
  );
}
