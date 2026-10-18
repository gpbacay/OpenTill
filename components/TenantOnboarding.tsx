"use client";

import React, { useState } from "react";
import { Tenant } from "@/lib/types";
import { Store, Plus, AlertCircle, Building2, Check, ArrowRight } from "lucide-react";

interface TenantOnboardingProps {
  tenants: Tenant[];
  activeTenant: Tenant;
  onAddTenant: (newTenant: Tenant) => void;
  onSwitchTenant: (tenantId: string) => void;
}

export function TenantOnboarding({
  tenants,
  activeTenant,
  onAddTenant,
  onSwitchTenant,
}: TenantOnboardingProps) {
  // Form states
  const [name, setName] = useState("");
  const [businessType, setBusinessType] = useState("Motorcycle Parts");
  const [taxRate, setTaxRate] = useState("12"); // 12% default
  const [currency, setCurrency] = useState("PHP");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Please provide a brand or store name.");
      return;
    }

    const parsedTax = parseFloat(taxRate);
    if (isNaN(parsedTax) || parsedTax < 0 || parsedTax > 100) {
      setError("Tax percentage must be between 0 and 100.");
      return;
    }

    const created: Tenant = {
      id: "tenant-" + Date.now(),
      name: name.trim(),
      businessType,
      taxRate: parsedTax / 100, // convert percentage e.g. 12 -> 0.12
      currency,
      createdAt: new Date().toISOString(),
      active: true,
    };

    onAddTenant(created);
    setSuccess(`Workspace "${created.name}" has been successfully onboarded!`);
    setName("");
    setTaxRate("12");
    setError("");

    setTimeout(() => {
      setSuccess("");
    }, 4000);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5 h-full bg-transparent overflow-y-auto lg:overflow-hidden pr-0.5 pb-10 lg:pb-0">
      {/* Onboarding Form */}
      <div className="bg-[#024959]/10 rounded-xl border border-[#024959] p-3 flex flex-col justify-between shadow-md">
        <div className="space-y-3">
          <div>
            <h4 className="text-[10px] font-mono text-[#89D9C2] uppercase tracking-wider">Tenant Provisioning Portal</h4>
            <p className="text-[9px] text-slate-400 font-mono">
              Instantiate isolated multi-tenant store scopes immediately.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-2.5">
            {error && (
              <div className="p-1.5 bg-red-950/40 border border-red-900/40 rounded flex items-start gap-1 text-[8px] text-red-200 animate-fade-in">
                <AlertCircle className="w-3 h-3 text-red-400 shrink-0 mt-0.5" />
                <p className="leading-tight">{error}</p>
              </div>
            )}

            {success && (
              <div className="p-1.5 bg-emerald-950/40 border border-emerald-900/40 rounded flex items-start gap-1 text-[8px] text-[#89D9C2] animate-fade-in">
                <Check className="w-3 h-3 text-[#89D9C2] shrink-0 mt-0.5" />
                <p className="leading-tight">{success}</p>
              </div>
            )}

            <div>
              <label className="block text-[8px] font-mono text-slate-400 uppercase tracking-wider mb-1">
                Store / Tenant Name *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Reyes Motor Parts"
                className="w-full bg-[#0D0D0D] border border-[#024959] rounded-lg px-2.5 py-1 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-[#208C8C]"
              />
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block text-[8px] font-mono text-slate-400 uppercase tracking-wider mb-1">
                  Business Industry
                </label>
                <select
                  value={businessType}
                  onChange={(e) => setBusinessType(e.target.value)}
                  className="w-full bg-[#0D0D0D] border border-[#024959] rounded-lg px-2 py-1 text-xs text-white focus:outline-none focus:border-[#208C8C]"
                >
                  <option value="Motorcycle Parts">Motorcycle Parts</option>
                  <option value="Food & Beverage">Food & Beverage</option>
                  <option value="Electronics Retail">Electronics Retail</option>
                  <option value="Boutique Fashion">Boutique Fashion</option>
                  <option value="Grocery Store">Grocery Store</option>
                  <option value="General Merchandising">General Merchandising</option>
                </select>
              </div>

              <div>
                <label className="block text-[8px] font-mono text-slate-400 uppercase tracking-wider mb-1">
                  Store Currency
                </label>
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="w-full bg-[#0D0D0D] border border-[#024959] rounded-lg px-2 py-1 text-xs text-white focus:outline-none focus:border-[#208C8C]"
                >
                  <option value="PHP">PHP (₱)</option>
                  <option value="USD">USD ($)</option>
                  <option value="EUR">EUR (€)</option>
                  <option value="GBP">GBP (£)</option>
                  <option value="SGD">SGD ($)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-[8px] font-mono text-slate-400 uppercase tracking-wider mb-1">
                Default Local Tax / VAT Rate (%)
              </label>
              <input
                type="number"
                step="0.1"
                value={taxRate}
                onChange={(e) => setTaxRate(e.target.value)}
                placeholder="12"
                className="w-full bg-[#0D0D0D] border border-[#024959] rounded-lg px-2.5 py-1 text-xs text-white focus:outline-none focus:border-[#208C8C] font-mono"
              />
            </div>

            <button
              type="submit"
              className="w-full bg-[#208C8C] hover:bg-[#208C8C]/85 text-[#010326] font-bold py-1.5 rounded-lg text-[10px] font-mono transition-all flex items-center justify-center gap-1 uppercase tracking-widest border border-[#89D9C2]/20 shadow-md"
            >
              <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
              Provision Tenant Workspace
            </button>
          </form>
        </div>

        <div className="mt-3 pt-2 border-t border-[#024959]/40 bg-[#0D0D0D]/40 p-2.5 rounded-lg flex items-start gap-1.5 text-[8.5px] text-slate-400 font-mono">
          <Building2 className="w-3.5 h-3.5 text-[#89D9C2] shrink-0" />
          <div>
            <span className="text-white font-bold">Isolated Routing:</span> Your sales records, custom inventories, transactions, and invoice logs are filtered at the virtual row level dynamically.
          </div>
        </div>
      </div>

      {/* Workspace Directory */}
      <div className="bg-[#024959]/10 rounded-xl border border-[#024959] p-3 flex flex-col h-[350px] lg:h-full overflow-hidden shadow-md">
        <div className="mb-2.5">
          <h4 className="text-[10px] font-mono text-[#89D9C2] uppercase tracking-wider">Active Workspace Directory</h4>
          <p className="text-[9px] text-slate-400 font-mono">
            Switch database scopes and catalogs instantly.
          </p>
        </div>

        <div className="flex-1 overflow-y-auto space-y-2 pr-0.5">
          {tenants.map((t) => {
            const isActive = t.id === activeTenant.id;
            return (
              <div
                key={t.id}
                onClick={() => onSwitchTenant(t.id)}
                className={`flex items-center justify-between p-2.5 rounded-lg border cursor-pointer transition-all ${
                  isActive
                    ? "bg-[#208C8C]/15 border-[#89D9C2]/50 shadow-sm"
                    : "bg-[#0D0D0D]/45 border-[#024959] hover:border-[#208C8C] hover:bg-[#024959]/10"
                }`}
              >
                <div className="space-y-0.5">
                  <div className="flex items-center gap-1.5">
                    <Store className={`w-3 h-3 ${isActive ? "text-[#89D9C2]" : "text-slate-500"}`} />
                    <span className="text-[11px] font-bold text-white leading-none">{t.name}</span>
                    {isActive && (
                      <span className="text-[7px] bg-[#89D9C2]/15 text-[#89D9C2] border border-[#89D9C2]/30 px-1 rounded uppercase font-mono">
                        Active Scope
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-[8.5px] font-mono text-slate-400">
                    <span>Industry: <span className="text-[#89D9C2]/80">{t.businessType}</span></span>
                    <span>•</span>
                    <span>VAT: <span className="text-white">{(t.taxRate * 100).toFixed(1)}%</span></span>
                    <span>•</span>
                    <span>Currency: <span className="text-[#89D9C2] font-semibold">{t.currency}</span></span>
                  </div>
                </div>

                <div className="shrink-0 pr-1">
                  {isActive ? (
                    <div className="bg-[#89D9C2] text-[#010326] p-0.5 rounded-full">
                      <Check className="w-2.5 h-2.5 stroke-[3]" />
                    </div>
                  ) : (
                    <ArrowRight className="w-3.5 h-3.5 text-[#208C8C]/50 hover:text-white transition-colors" />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
