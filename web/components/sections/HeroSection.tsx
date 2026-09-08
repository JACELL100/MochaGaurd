"use client";

import React, { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Play,
  Zap,
  Layers,
  Lock,
  BarChart3,
} from "lucide-react";
import { ThreeEarthGlobe } from "../backgrounds/ThreeEarthGlobe";

export function HeroSection() {
  const [isPlayingDemo, setIsPlayingDemo] = useState(false);

  const pillars = [
    {
      icon: Zap,
      title: "Sub-Second",
      subtitle: "Risk Detection",
      color: "text-[#A78BFA]",
      glow: "rgba(167, 139, 250, 0.4)",
    },
    {
      icon: Layers,
      title: "On-Chain",
      subtitle: "Settlement Proofs",
      color: "text-[#C4B5FD]",
      glow: "rgba(196, 181, 253, 0.4)",
    },
    {
      icon: Lock,
      title: "Automated",
      subtitle: "Liquidation Protection",
      color: "text-[#8B5CF6]",
      glow: "rgba(139, 92, 246, 0.4)",
    },
    {
      icon: BarChart3,
      title: "Unified Portfolio",
      subtitle: "Across Exchanges",
      color: "text-[#7C3AED]",
      glow: "rgba(124, 58, 237, 0.4)",
    },
  ];

  const liveTickers = [
    { symbol: "BTC", price: "$25,432.10", change: "+2.4%", up: true, icon: "₿", color: "#F7931A" },
    { symbol: "ETH", price: "$1,628.34", change: "+1.7%", up: true, icon: "◆", color: "#627EEA" },
    { symbol: "SOL", price: "$121.09", change: "-0.3%", up: false, icon: "◎", color: "#14F195" },
    { symbol: "NASDAQ", price: "18,432.21", change: "+0.6%", up: true, icon: "📈", color: "#38BDF8" },
    { symbol: "S&P 500", price: "5,217.36", change: "+0.4%", up: true, icon: "📊", color: "#EF4444" },
  ];

  return (
    <section className="relative w-full min-h-[100vh] flex flex-col justify-between overflow-hidden bg-[#05050A] text-white pt-20">
      {/* 1. Deep Space Cosmic Radial Lighting */}
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(1300px_750px_at_50%_12%,rgba(124,58,237,0.18)_0%,transparent_60%),radial-gradient(900px_500px_at_85%_35%,rgba(99,102,241,0.08)_0%,transparent_50%),#05050A]" />

      {/* 2. Photorealistic 3D Earth Globe Horizon with Natural Night-Lights & Thin Edge Halo */}
      <div className="absolute inset-0 pointer-events-none select-none flex items-end justify-center">
        <div className="relative w-full h-[620px] sm:h-[720px] md:h-[840px] flex items-center justify-center pointer-events-auto">
          {/* Photorealistic 3D Earth Globe */}
          <ThreeEarthGlobe className="w-full h-full" />

          {/* Soft Bottom Horizon Fade into Ticker */}
          <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-[#05050A] via-[#05050A]/70 to-transparent pointer-events-none" />
        </div>
      </div>

      {/* 3. Hero Content Header & Typography */}
      <div className="relative z-20 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center flex flex-col items-center pt-6 pb-4">
        {/* Top Tracking Micro-Tagline */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="mb-4"
        >
          <span className="text-[11px] sm:text-xs font-mono font-semibold tracking-[0.35em] text-[#94A3B8] uppercase">
            PROTECT · MONITOR · TRADE · SLEEP BETTER
          </span>
        </motion.div>

        {/* Master Heading */}
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
          className="text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight text-white leading-[1.08] drop-shadow-[0_12px_35px_rgba(0,0,0,0.9)]"
        >
          A Safer Tomorrow <br />
          for <span className="bg-gradient-to-r from-[#C4B5FD] via-[#A78BFA] to-[#7C3AED] bg-clip-text text-transparent drop-shadow-[0_0_25px_rgba(124,58,237,0.6)]">Your Trades.</span>
        </motion.h1>

        {/* Subtitle */}
        <motion.p
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
          className="mt-5 text-sm sm:text-base text-[#CBD5E1] max-w-2xl font-normal leading-relaxed drop-shadow-md"
        >
          Real-time risk monitoring, automated protection and on-chain transparency for your crypto &amp; stock portfolios. Because opportunities shouldn&apos;t turn into liquidations.
        </motion.p>

        {/* Call to Action Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
          className="mt-8 flex flex-wrap items-center justify-center gap-4"
        >
          <a
            href="#console"
            className="px-7 py-3 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-[#7C3AED] to-[#6D28D9] hover:from-[#8B5CF6] hover:to-[#7C3AED] shadow-[0_0_30px_rgba(124,58,237,0.6)] border border-[#A78BFA]/50 flex items-center gap-2 transition-all transform hover:-translate-y-0.5 active:translate-y-0"
          >
            Launch Live Console <ArrowRight className="w-4 h-4 text-[#C4B5FD]" />
          </a>

          <Link
            href="/tonight"
            className="px-6 py-3 rounded-xl text-sm font-semibold text-[#E2E8F0] bg-[#0B0A14]/90 hover:bg-[#181530] border border-[#231F42] hover:border-[#7C3AED]/60 backdrop-blur-xl flex items-center gap-2 transition-all shadow-[0_6px_20px_rgba(0,0,0,0.6)]"
          >
            <Play className="w-3.5 h-3.5 fill-[#A78BFA] text-[#A78BFA]" />
            Watch Demo
          </Link>
        </motion.div>
      </div>

      {/* 4. Left & Right Floating Trade Stat Cards */}
      <div className="absolute inset-0 pointer-events-none z-20 hidden md:block">
        {/* Left Floating BTC Price Card */}
        <motion.div
          initial={{ opacity: 0, x: -30, y: 20 }}
          animate={{
            opacity: 1,
            x: 0,
            y: [0, -8, 0],
          }}
          transition={{
            opacity: { duration: 0.8, delay: 0.3 },
            x: { duration: 0.8, delay: 0.3 },
            y: { duration: 6, repeat: Infinity, ease: "easeInOut" },
          }}
          className="absolute left-[5%] lg:left-[8%] xl:left-[10%] top-[24%] pointer-events-auto"
        >
          <div className="relative group w-64 rounded-2xl bg-[#0B0A14]/92 border border-[#F7931A]/40 p-4 shadow-[0_15px_35px_rgba(0,0,0,0.8),0_0_25px_rgba(247,147,26,0.2)] backdrop-blur-xl transition-transform hover:scale-105">
            {/* Header: BTC Icon & Price */}
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-full bg-[#F7931A] text-black font-bold text-sm flex items-center justify-center shadow-[0_0_12px_#F7931A]">
                  ₿
                </div>
                <div>
                  <div className="text-[11px] font-mono text-[#94A3B8]">BTC</div>
                  <div className="text-base font-bold font-mono text-white">$25,432.10</div>
                </div>
              </div>
              <span className="px-2 py-0.5 rounded-full text-[11px] font-mono font-bold text-emerald-400 bg-emerald-500/15 border border-emerald-500/30">
                +2.4%
              </span>
            </div>

            {/* Sparkline Wave */}
            <div className="w-full h-10 mt-2">
              <svg viewBox="0 0 200 40" className="w-full h-full overflow-visible">
                <path
                  d="M 0 30 Q 30 35, 60 20 T 120 15 T 160 8 T 200 5"
                  fill="none"
                  stroke="#10B981"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  className="filter drop-shadow-[0_0_8px_#10B981]"
                />
              </svg>
            </div>

            {/* Subtle glow border */}
            <div className="absolute inset-0 rounded-2xl border border-[#F7931A]/30 pointer-events-none" />
          </div>

          {/* Subtitle tag below card */}
          <div className="mt-3 text-left pl-2">
            <span className="text-[10px] font-mono tracking-[0.2em] text-[#64748B] uppercase">
              REAL-TIME MONITORING
            </span>
          </div>
        </motion.div>

        {/* Right Floating ETH Price Card */}
        <motion.div
          initial={{ opacity: 0, x: 30, y: 20 }}
          animate={{
            opacity: 1,
            x: 0,
            y: [0, 8, 0],
          }}
          transition={{
            opacity: { duration: 0.8, delay: 0.4 },
            x: { duration: 0.8, delay: 0.4 },
            y: { duration: 6.5, repeat: Infinity, ease: "easeInOut", delay: 0.5 },
          }}
          className="absolute right-[5%] lg:right-[8%] xl:right-[10%] top-[28%] pointer-events-auto"
        >
          <div className="relative group w-64 rounded-2xl bg-[#0B0A14]/92 border border-[#8B5CF6]/40 p-4 shadow-[0_15px_35px_rgba(0,0,0,0.8),0_0_25px_rgba(139,92,246,0.25)] backdrop-blur-xl transition-transform hover:scale-105">
            {/* Header: ETH Icon & Price */}
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-full bg-[#627EEA] text-white font-bold text-xs flex items-center justify-center shadow-[0_0_12px_#627EEA]">
                  ◆
                </div>
                <div>
                  <div className="text-[11px] font-mono text-[#94A3B8]">ETH</div>
                  <div className="text-base font-bold font-mono text-white">$1,628.34</div>
                </div>
              </div>
              <span className="px-2 py-0.5 rounded-full text-[11px] font-mono font-bold text-emerald-400 bg-emerald-500/15 border border-emerald-500/30">
                +1.7%
              </span>
            </div>

            {/* Sparkline Wave */}
            <div className="w-full h-10 mt-2">
              <svg viewBox="0 0 200 40" className="w-full h-full overflow-visible">
                <path
                  d="M 0 32 Q 40 25, 80 30 T 130 18 T 170 12 T 200 6"
                  fill="none"
                  stroke="#A78BFA"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  className="filter drop-shadow-[0_0_8px_#A78BFA]"
                />
              </svg>
            </div>

            {/* Subtle glow border */}
            <div className="absolute inset-0 rounded-2xl border border-[#8B5CF6]/30 pointer-events-none" />
          </div>

          {/* Subtitle tag below card */}
          <div className="mt-3 text-right pr-2">
            <span className="text-[10px] font-mono tracking-[0.2em] text-[#64748B] uppercase">
              AUTOMATED PROTECTION
            </span>
          </div>
        </motion.div>
      </div>

      {/* 5. Globe Center Status & 4-Pillar Floating Glass Dock */}
      <div className="relative z-30 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 w-full flex flex-col items-center mt-auto pb-4">
        {/* Central Tag Above Dock */}
        <div className="flex flex-col items-center mb-6">
          <span className="text-[10px] font-mono font-semibold tracking-[0.3em] text-[#94A3B8] uppercase">
            GLOBAL MARKETS. PROTECTED.
          </span>
          <div className="w-px h-6 bg-gradient-to-b from-[#7C3AED]/60 to-transparent mt-2" />
        </div>

        {/* 4-Pillar Floating Glass Dock */}
        <motion.div
          initial={{ opacity: 0, y: 25 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.4, ease: "easeOut" }}
          className="w-full max-w-4xl grid grid-cols-2 md:grid-cols-4 gap-3 p-3.5 sm:p-4 rounded-2xl bg-[#0B0A14]/90 border border-[#231F42] shadow-[0_20px_40px_rgba(0,0,0,0.8),0_0_30px_rgba(124,58,237,0.15)] backdrop-blur-xl"
        >
          {pillars.map((item, idx) => {
            const Icon = item.icon;
            return (
              <div
                key={idx}
                className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-[#121024]/60 transition-colors group cursor-default"
              >
                <div
                  className="w-10 h-10 rounded-xl bg-[#121024] border border-[#231F42] flex items-center justify-center shrink-0 transition-transform group-hover:scale-110"
                  style={{
                    boxShadow: `0 0 15px ${item.glow}`,
                  }}
                >
                  <Icon className={`w-5 h-5 ${item.color}`} />
                </div>
                <div className="text-left">
                  <div className="text-xs font-bold text-white leading-tight">{item.title}</div>
                  <div className="text-[11px] text-[#94A3B8] leading-tight mt-0.5">{item.subtitle}</div>
                </div>
              </div>
            );
          })}
        </motion.div>
      </div>

      {/* 6. Bottom Live Market Ticker Bar */}
      <div className="relative z-30 w-full bg-[#05050A]/95 border-t border-[#1C1836] py-3 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4 text-xs font-mono">
          {/* Left: Live Markets Label & Tickers */}
          <div className="flex items-center flex-wrap gap-5">
            <div className="flex items-center gap-2 font-bold text-[#E2E8F0]">
              <span>LIVE MARKETS</span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            </div>

            <div className="flex items-center flex-wrap gap-4 text-[#CBD5E1]">
              {liveTickers.map((t) => (
                <div key={t.symbol} className="flex items-center gap-1.5">
                  <span className="font-bold text-white flex items-center gap-1">
                    <span style={{ color: t.color }}>{t.icon}</span>
                    {t.symbol}
                  </span>
                  <span>{t.price}</span>
                  <span className={t.up ? "text-emerald-400 font-semibold" : "text-rose-400 font-semibold"}>
                    {t.change}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Right: Operational Status Indicator */}
          <div className="flex items-center gap-2 text-emerald-400 font-medium">
            <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_#10B981] animate-pulse" />
            <span>All Systems Operational</span>
          </div>
        </div>
      </div>
    </section>
  );
}
