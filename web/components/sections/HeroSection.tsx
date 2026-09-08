"use client";

import React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, ShieldCheck, Activity } from "lucide-react";
import { GlowingRidges } from "../backgrounds/GlowingRidges";

export function HeroSection() {
  const stats = [
    { label: "Deterministic Latency", value: "< 1.2 ms", hint: "0 DB calls during evaluation" },
    { label: "On-Chain Anchoring", value: "Sepolia Testnet", hint: "Daily sorted Keccak Merkle root" },
    { label: "AI Copilot Guard", value: "Fact-Bounded", hint: "Strict deterministic citations only" },
    { label: "Liquidation Protection", value: "Overnight p99", hint: "Dynamic earnings volatility buffer" },
  ];

  return (
    <section className="relative min-h-[90vh] flex flex-col items-center justify-center pt-24 pb-16 overflow-hidden">
      {/* 1. Ambient Radial Glow Background */}
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,rgba(124,58,237,0.22)_0%,rgba(11,10,20,0.85)_60%,#05050A_100%)]" />

      {/* 2. ReactBits Glowing Ridges 3D Wave Bed */}
      <div className="absolute inset-0 pointer-events-none opacity-60 mix-blend-screen">
        <GlowingRidges ridgeCount={16} speed={0.007} />
      </div>

      {/* 3. Hero Content Foreground */}
      <div className="relative z-30 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center flex flex-col items-center">
        {/* Top Tagline Badge */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="mb-6"
        >
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#0B0A14]/90 border border-[#7C3AED]/40 backdrop-blur-xl shadow-[0_0_25px_rgba(124,58,237,0.3)]">
            <span className="w-2 h-2 rounded-full bg-[#A78BFA] animate-ping" />
            <span className="text-xs font-semibold tracking-wide text-[#E2E8F0]">
              Mochatrade Risk Engine · Continuous Liquidation Guard
            </span>
          </div>
        </motion.div>

        {/* Master Heading */}
        <motion.h1
          initial={{ opacity: 0, y: 25 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
          className="text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight text-white leading-[1.08] drop-shadow-[0_10px_25px_rgba(0,0,0,0.8)]"
        >
          Trust the Trade. <br />
          <span className="text-gradient-amethyst">Sleep Safe Tonight.</span>
        </motion.h1>

        {/* Subtitle */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
          className="mt-6 text-base sm:text-lg text-[#CBD5E1] max-w-2xl font-normal leading-relaxed drop-shadow-md"
        >
          Real-time leverage and overnight margin surveillance for linked brokerage accounts.
          Anchored on-chain with cryptographic Merkle proofs and zero hallucinated metrics.
        </motion.p>

        {/* Call to Action Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
          className="mt-10 flex flex-wrap items-center justify-center gap-4"
        >
          <a
            href="#console"
            className="px-8 py-3.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-[#7C3AED] via-[#6D28D9] to-[#4C1D95] hover:from-[#8B5CF6] hover:to-[#6D28D9] shadow-[0_0_35px_rgba(124,58,237,0.55)] border border-[#A78BFA]/40 flex items-center gap-2 transition-all transform hover:-translate-y-0.5 active:translate-y-0"
          >
            Open Live Book Console <ArrowRight className="w-4 h-4 text-[#C4B5FD]" />
          </a>

          <Link
            href="/tonight"
            className="px-6 py-3.5 rounded-xl text-sm font-semibold text-[#E2E8F0] bg-[#0B0A14]/85 hover:bg-[#121024] border border-[#231F42] hover:border-[#7C3AED]/60 backdrop-blur-xl flex items-center gap-2 transition-all shadow-[0_4px_20px_rgba(0,0,0,0.5)]"
          >
            <Activity className="w-4 h-4 text-[#A78BFA]" />
            The 2 AM Problem
          </Link>

          <Link
            href="/verify"
            className="px-6 py-3.5 rounded-xl text-sm font-semibold text-[#E2E8F0] bg-[#0B0A14]/85 hover:bg-[#121024] border border-[#231F42] hover:border-[#7C3AED]/60 backdrop-blur-xl flex items-center gap-2 transition-all shadow-[0_4px_20px_rgba(0,0,0,0.5)]"
          >
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            Verify On-Chain
          </Link>
        </motion.div>

        {/* Live Key Metrics Bar */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="mt-16 w-full max-w-4xl grid grid-cols-2 md:grid-cols-4 gap-3 p-4 rounded-2xl glass-panel border border-[#231F42] shadow-[0_15px_35px_rgba(0,0,0,0.6)]"
        >
          {stats.map((s, idx) => (
            <div key={idx} className="p-3 text-left">
              <span className="text-[11px] font-mono uppercase tracking-wider text-[#94A3B8]">
                {s.label}
              </span>
              <div className="text-base font-bold font-mono text-white mt-0.5">
                {s.value}
              </div>
              <span className="text-[11px] text-[#64748B] block mt-0.5">{s.hint}</span>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
