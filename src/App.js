import React, { useState } from "react";

const fmt = (n) => new Intl.NumberFormat("en-BD").format(Math.round(n));
const fmtL = (n) => (n / 100000).toFixed(2) + " লক্ষ";
const fmtQ = (n) => (Math.round(n * 100) / 100).toLocaleString();
const round2 = (n) => Math.round(n * 100) / 100;

const CF = { soil: 1.25, sand: 1.15, subBase: 1.20, aggregateBase: 1.18, bitumin: 1.05 };
const EFF = { excavator: 0.80, grader: 0.75, roller: 0.82, paver: 0.78, plant: 0.80, truck: 0.72, mixer: 0.75, compactor: 0.80, tanker: 0.85 };
const PROD = { excavator: 120, grader: 2500, vibRoller: 900, pneumaticRoller: 700, asphaltPlant: 60, paver: 480, dumpTruck: 10, waterTanker: 8000, concMixer: 3.5, plateCompactor: 60 };
const RATES = {
  boxCutting: 850, improveSubGrade: 1200, subBase: 2800, aggregateBase: 4500,
  bituminousPrimeCoat: 180, wearingCourse: 12000, brickOnEnd: 85,
  roadwayExcavation: 750, sandFilling: 900, brickFlatSoling: 550,
  cc3inch: 6500, brickwall10inch: 5200, plaster12inch: 320,
  excavationBackfill: 680, herringBondBrick: 680,
  laborSkilled: 900, laborUnskilled: 600, laborSemiSkilled: 750,
  excavatorHour: 3500, rollerHour: 4500, dumpTruckHour: 5500,
  motorGraderHour: 6000, asphaltPlantHour: 25000, paverHour: 12000,
  waterTankerHour: 3000, concreteLabHour: 3500, transitMixerHour: 4500,
};

// ═══════════════════════════════════════════════════════════════════
// MATERIAL MASTER LAYER — reusable engineering database
// Architecture: BOQ → Material Breakdown Rules → Material Master → Material Summary
// This layer is the single source of truth for material coefficients and will be
// reused by future modules (Equipment, Labour, Rate Analysis, Procurement,
// Inventory, Billing, Reports). It never recomputes BOQ quantities — it only
// converts already-computed BOQ quantities into constituent materials.
// ═══════════════════════════════════════════════════════════════════

// Material Properties — one row per material (all values editable at runtime via UI state)
const MATERIAL_PROPERTIES = {
  "Sand": { profile: "Natural Sand", unit: "Cum", density: 1600, looseFactor: 1.15, bulkingFactor: 1.10, compactionFactor: 1.0, wastagePct: 5, truckCapacity: 8, remarks: "" },
  "Stone Chips": { profile: "20mm Chips", unit: "Cum", density: 1500, looseFactor: 1.10, bulkingFactor: 1.0, compactionFactor: 1.0, wastagePct: 3, truckCapacity: 8, remarks: "" },
  "Aggregate": { profile: "Road Aggregate", unit: "Cum", density: 1550, looseFactor: 1.15, bulkingFactor: 1.05, compactionFactor: 1.18, wastagePct: 3, truckCapacity: 10, remarks: "" },
  "Sub-base Material": { profile: "Sub-base Material", unit: "Cum", density: 1650, looseFactor: 1.15, bulkingFactor: 1.05, compactionFactor: 1.20, wastagePct: 3, truckCapacity: 10, remarks: "" },
  "Cement": { profile: "OPC / PCC", unit: "Bag", density: null, looseFactor: null, bulkingFactor: null, compactionFactor: null, wastagePct: 2, truckCapacity: null, remarks: "Packaged — N/A for loose/bulking" },
  "Brick": { profile: "1st Class Brick", unit: "Nos", density: null, looseFactor: null, bulkingFactor: null, compactionFactor: null, wastagePct: 5, truckCapacity: 3500, remarks: "Truck capacity in Nos/trip" },
  "Bitumen": { profile: "VG-30 / VG-40", unit: "MT", density: 1030, looseFactor: 1.0, bulkingFactor: 1.0, compactionFactor: 1.05, wastagePct: 2, truckCapacity: 12, remarks: "" },
  "Water": { profile: "Construction Water", unit: "Liter", density: 1000, looseFactor: null, bulkingFactor: null, compactionFactor: null, wastagePct: 5, truckCapacity: 6000, remarks: "" },
  "Earth": { profile: "Excavated Soil", unit: "Cum", density: 1450, looseFactor: 1.25, bulkingFactor: 1.10, compactionFactor: 1.0, wastagePct: 0, truckCapacity: 8, remarks: "" },
  "Concrete": { profile: "1:2:4 / 1:1.5:3 etc.", unit: "Cum", density: 2400, looseFactor: null, bulkingFactor: null, compactionFactor: null, wastagePct: 2, truckCapacity: null, remarks: "Mixed on-site" },
  "Pipe": { profile: "RCC / HDPE / PVC", unit: "Meter", density: null, looseFactor: null, bulkingFactor: null, compactionFactor: null, wastagePct: 2, truckCapacity: null, remarks: "" },
  "Filter Material": { profile: "Filter Sand / Gravel", unit: "Cum", density: 1600, looseFactor: 1.15, bulkingFactor: 1.10, compactionFactor: 1.0, wastagePct: 5, truckCapacity: 8, remarks: "" },
};

// Mix / Consumption Profiles — one row per profile, holding the ratios organizations differ on
const MIX_PROFILES = {
  "Earthwork - Excavated Soil": { materials: [{ material: "Earth", coeff: 1.0 }] },
  "Sub-base Material - Direct": { materials: [{ material: "Sub-base Material", coeff: 1.0 }] },
  "Aggregate Base - Direct": { materials: [{ material: "Aggregate", coeff: 1.0 }] },
  "Bituminous Wearing Course": { materials: [{ material: "Bitumen", coeff: 0.122 }, { material: "Aggregate", coeff: 0.90 }] },
  "Bituminous Prime Coat": { materials: [{ material: "Bitumen", coeff: 0.001 }] },
  "Brick Edging Course": { materials: [{ material: "Brick", coeff: 9 }] },
  "Brick Flat Soling": { materials: [{ material: "Brick", coeff: 33 }] },
  "Brick Herring Bone": { materials: [{ material: "Brick", coeff: 46 }] },
  "Concrete 1:2:4": { materials: [{ material: "Cement", coeff: 6.0 }, { material: "Sand", coeff: 0.42 }, { material: "Stone Chips", coeff: 0.84 }, { material: "Water", coeff: 150 }] },
  "Brick Masonry 1:6": { materials: [{ material: "Brick", coeff: 500 }, { material: "Cement", coeff: 1.0 }, { material: "Sand", coeff: 0.30 }] },
  "Plaster 1:4 (12mm)": { materials: [{ material: "Cement", coeff: 0.09 }, { material: "Sand", coeff: 0.014 }] },
  "Natural Sand - Direct": { materials: [{ material: "Sand", coeff: 1.0 }] },
};

// Material Breakdown Rules — ONLY says which profile a BOQ item uses. No coefficients here.
// Keyed by the same internal keys calcQuantities() already produces (stable, label-independent).
const BOQ_MATERIAL_PROFILE_MAP = {
  boxCutting: "Earthwork - Excavated Soil", isg: "Earthwork - Excavated Soil",
  hbbExc: "Earthwork - Excavated Soil", hbbIsg: "Earthwork - Excavated Soil",
  uExc: "Earthwork - Excavated Soil", lExc: "Earthwork - Excavated Soil",
  uBackfill: "Earthwork - Excavated Soil", lBackfill: "Earthwork - Excavated Soil",
  subBase: "Sub-base Material - Direct",
  aggBase: "Aggregate Base - Direct",
  wearingCourse: "Bituminous Wearing Course",
  primeCoat: "Bituminous Prime Coat",
  brickEdging: "Brick Edging Course", hbbEdge: "Brick Edging Course",
  hbbSoling: "Brick Flat Soling", uSoling: "Brick Flat Soling", lSoling: "Brick Flat Soling",
  hbbHerring: "Brick Herring Bone",
  uCC: "Concrete 1:2:4", lCC: "Concrete 1:2:4",
  uWall: "Brick Masonry 1:6", lWall: "Brick Masonry 1:6",
  uPlaster: "Plaster 1:4 (12mm)", lPlaster: "Plaster 1:4 (12mm)",
  uSand: "Natural Sand - Direct", lSand: "Natural Sand - Direct",
};

// ── Organization Profile / Version scaffold ──
// Not exposed in UI this phase. Wrapping the data above in this shape now means a future
// Organization Profile + Version selector can be added later with ZERO changes to
// Material Breakdown Rules, Material Summary, or any dependent module — only new entries
// need to be added to ORG_STANDARDS, and ACTIVE_STANDARD_ID becomes a user-driven selector.
const ORG_STANDARDS = {
  RHD_2023: {
    id: "RHD_2023",
    orgProfile: "RHD Standard",
    version: "2023",
    materialProperties: MATERIAL_PROPERTIES,
    mixProfiles: MIX_PROFILES,
    transportDefaults: {}, // reserved: per-org transport defaults override Material Properties truckCapacity etc.
    wastageFactors: {},    // reserved: per-org wastage override, else falls back to MATERIAL_PROPERTIES.wastagePct
  },
  // Future additions (LGED_2024, BWDB_2023, PWD_2023, ARMY_2023, PRIVATE_CUSTOM, ...) go here only —
  // no changes needed anywhere else in the app.
};
const ACTIVE_STANDARD_ID = "RHD_2023"; // single switch point for a future Organization Profile selector

// ── Project-level override scaffold ──
// Empty by default this phase (no Override UI yet). Shape supports per-material and
// per-profile partial overrides. Resolution precedence is always:
// 1. Project Override → 2. Active Organization Standard → 3. System Default (seed values above).
const PROJECT_OVERRIDES = { materialProperties: {}, mixProfiles: {} };

// Resolvers — the ONLY functions allowed to read engineering coefficients.
// Material Summary and every future module must go through these, never read the raw tables directly,
// so that Organization Profile switching / Version switching / Project Overrides "just work" later.
function resolveMaterialProperty(material, sessionOverrides) {
  const std = ORG_STANDARDS[ACTIVE_STANDARD_ID];
  return {
    ...(std.materialProperties[material] || {}),
    ...(PROJECT_OVERRIDES.materialProperties[material] || {}),
    ...((sessionOverrides && sessionOverrides[material]) || {}), // in-session edits from the Material Master UI
  };
}
function resolveMixProfile(profileName, sessionOverrides) {
  const std = ORG_STANDARDS[ACTIVE_STANDARD_ID];
  const base = std.mixProfiles[profileName];
  if (!base) return null;
  const projOv = PROJECT_OVERRIDES.mixProfiles[profileName];
  const sessOv = sessionOverrides && sessionOverrides[profileName];
  return {
    materials: base.materials.map(m => ({
      ...m,
      ...(projOv?.materials?.find(x => x.material === m.material) || {}),
      ...(sessOv?.materials?.find(x => x.material === m.material) || {}),
    })),
  };
}

// ─── MACHINE SPECIFICATION DEFINITIONS ───
const MACHINE_SPECS = [
  {
    id: "excavator",
    name: "Excavator (PC-200 বা সমমান)",
    icon: "🚜",
    required: { qty: 2, phase: "Earthwork (D1-D14)" },
    specs: [
      { label: "মডেল / ব্র্যান্ড", type: "text", placeholder: "Komatsu PC-200 / Hitachi ZX200", required: true },
      { label: "ইঞ্জিন ক্ষমতা (HP)", type: "number", placeholder: "148", minVal: 130, maxVal: 200, unit: "HP" },
      { label: "বালতির ধারণক্ষমতা (m³)", type: "number", placeholder: "0.8", minVal: 0.6, maxVal: 1.2, unit: "m³" },
      { label: "খননের সর্বোচ্চ গভীরতা (m)", type: "number", placeholder: "6.5", minVal: 5.5, maxVal: 8, unit: "m" },
      { label: "মেশিনের বয়স (বছর)", type: "number", placeholder: "5", minVal: 0, maxVal: 10, unit: "বছর" },
      { label: "শেষ সার্ভিসিং তারিখ", type: "date", placeholder: "" },
      { label: "মালিকানা (নিজস্ব/ভাড়া)", type: "select", options: ["নিজস্ব (Owned)", "ভাড়া (Rented)", "Lease"] },
      { label: "অপারেটরের অভিজ্ঞতা (বছর)", type: "number", placeholder: "5", minVal: 3, maxVal: 30, unit: "বছর" },
      { label: "পার্বত্য অঞ্চলে কাজের অভিজ্ঞতা", type: "select", options: ["হ্যাঁ, অভিজ্ঞ", "হ্যাঁ, কিছু অভিজ্ঞতা", "না"] },
      { label: "ট্র্যাক / টায়ার টাইপ", type: "select", options: ["Crawler Track (পার্বত্যের জন্য উপযুক্ত)", "Rubber Track", "Wheeled (অনুপযুক্ত)"] },
      { label: "হাইড্রোলিক সিস্টেম অবস্থা", type: "select", options: ["চমৎকার", "ভালো", "মোটামুটি (মেরামত দরকার)", "খারাপ"] },
      { label: "অনুমানিত দৈনিক উৎপাদন (cum/day)", type: "number", placeholder: "960", minVal: 500, maxVal: 1500, unit: "cum" },
    ],
    criteria: [
      { label: "ইঞ্জিন HP ≥ 130", check: "ইঞ্জিন ক্ষমতা (HP)", min: 130 },
      { label: "বালতি ≥ 0.6 m³", check: "বালতির ধারণক্ষমতা (m³)", min: 0.6 },
      { label: "গভীরতা ≥ 5.5m", check: "খননের সর্বোচ্চ গভীরতা (m)", min: 5.5 },
      { label: "বয়স ≤ 10 বছর", check: "মেশিনের বয়স (বছর)", max: 10 },
    ]
  },
  {
    id: "motor_grader",
    name: "Motor Grader (RHD স্পেসিফিকেশন)",
    icon: "🚧",
    required: { qty: 1, phase: "Base (D7-D22)" },
    specs: [
      { label: "মডেল / ব্র্যান্ড", type: "text", placeholder: "Caterpillar 140M / XCMG GR215", required: true },
      { label: "ইঞ্জিন ক্ষমতা (HP)", type: "number", placeholder: "215", minVal: 150, maxVal: 300, unit: "HP" },
      { label: "Blade দৈর্ঘ্য (m)", type: "number", placeholder: "3.66", minVal: 3.0, maxVal: 4.5, unit: "m" },
      { label: "Blade আর্টিকুলেশন", type: "select", options: ["±90° (পূর্ণ)", "±60° (পর্যাপ্ত)", "সীমিত"] },
      { label: "মেশিনের বয়স (বছর)", type: "number", placeholder: "5", minVal: 0, maxVal: 12, unit: "বছর" },
      { label: "Circle Drive System", type: "select", options: ["সম্পূর্ণ কার্যকর", "আংশিক সমস্যা", "মেরামত দরকার"] },
      { label: "শেষ সার্ভিসিং তারিখ", type: "date", placeholder: "" },
      { label: "অপারেটরের অভিজ্ঞতা (বছর)", type: "number", placeholder: "5", minVal: 3, maxVal: 30, unit: "বছর" },
      { label: "পাহাড়ি রাস্তায় কাজের সক্ষমতা", type: "select", options: ["হ্যাঁ, পার্বত্যে অভিজ্ঞ", "সমতলে কাজ করেছে", "অনভিজ্ঞ"] },
      { label: "অনুমানিত দৈনিক আউটপুট (sqm/day)", type: "number", placeholder: "15000", minVal: 8000, maxVal: 20000, unit: "sqm" },
    ],
    criteria: [
      { label: "HP ≥ 150", check: "ইঞ্জিন ক্ষমতা (HP)", min: 150 },
      { label: "Blade ≥ 3.0m", check: "Blade দৈর্ঘ্য (m)", min: 3.0 },
      { label: "বয়স ≤ 12 বছর", check: "মেশিনের বয়স (বছর)", max: 12 },
    ]
  },
  {
    id: "vib_roller",
    name: "Vibratory Roller (10T+)",
    icon: "🛞",
    required: { qty: 2, phase: "Base (D7-D23)" },
    specs: [
      { label: "মডেল / ব্র্যান্ড", type: "text", placeholder: "DYNAPAC CA250 / Bomag BW211", required: true },
      { label: "স্ট্যাটিক ওজন (Ton)", type: "number", placeholder: "10", minVal: 8, maxVal: 15, unit: "Ton" },
      { label: "ভাইব্রেশন ফ্রিকোয়েন্সি (Hz)", type: "number", placeholder: "33", minVal: 25, maxVal: 50, unit: "Hz" },
      { label: "ড্রাম প্রস্থ (mm)", type: "number", placeholder: "2130", minVal: 1800, maxVal: 2500, unit: "mm" },
      { label: "কম্প্যাকশন গভীরতা (mm)", type: "number", placeholder: "500", minVal: 300, maxVal: 700, unit: "mm" },
      { label: "মেশিনের বয়স (বছর)", type: "number", placeholder: "5", minVal: 0, maxVal: 12, unit: "বছর" },
      { label: "ভাইব্রেটর সিস্টেম কার্যকর?", type: "select", options: ["সম্পূর্ণ কার্যকর", "আংশিক সমস্যা", "মেরামত দরকার"] },
      { label: "শেষ সার্ভিসিং তারিখ", type: "date", placeholder: "" },
      { label: "Water Sprinkler System", type: "select", options: ["কার্যকর", "মেরামত দরকার", "নেই"] },
      { label: "অনুমানিত দৈনিক আউটপুট (sqm/day)", type: "number", placeholder: "5900", minVal: 3000, maxVal: 8000, unit: "sqm" },
    ],
    criteria: [
      { label: "ওজন ≥ 8 Ton", check: "স্ট্যাটিক ওজন (Ton)", min: 8 },
      { label: "Frequency ≥ 25 Hz", check: "ভাইব্রেশন ফ্রিকোয়েন্সি (Hz)", min: 25 },
      { label: "Drum ≥ 1800mm", check: "ড্রাম প্রস্থ (mm)", min: 1800 },
      { label: "বয়স ≤ 12 বছর", check: "মেশিনের বয়স (বছর)", max: 12 },
    ]
  },
  {
    id: "pneumatic_roller",
    name: "Pneumatic Tyre Roller",
    icon: "⚙️",
    required: { qty: 1, phase: "Surface (D21-D28)" },
    specs: [
      { label: "মডেল / ব্র্যান্ড", type: "text", placeholder: "DYNAPAC CP274 / Hamm GRW280i", required: true },
      { label: "কার্যকরী ওজন (Ton)", type: "number", placeholder: "16", minVal: 10, maxVal: 25, unit: "Ton" },
      { label: "টায়ার সংখ্যা (Nos)", type: "number", placeholder: "9", minVal: 7, maxVal: 11, unit: "Nos" },
      { label: "টায়ার চাপ নিয়ন্ত্রণ", type: "select", options: ["Variable (CTIS)", "Fixed", "Manual Adjustment"] },
      { label: "Ballast যোগ করার সুবিধা", type: "select", options: ["আছে", "নেই"] },
      { label: "মেশিনের বয়স (বছর)", type: "number", placeholder: "6", minVal: 0, maxVal: 15, unit: "বছর" },
      { label: "সকল টায়ারের অবস্থা", type: "select", options: ["সব টায়ার ভালো", "কিছু টায়ার পরিবর্তন দরকার", "অধিকাংশ টায়ার খারাপ"] },
      { label: "অনুমানিত দৈনিক আউটপুট (sqm/day)", type: "number", placeholder: "4500", minVal: 2000, maxVal: 6000, unit: "sqm" },
    ],
    criteria: [
      { label: "ওজন ≥ 10 Ton", check: "কার্যকরী ওজন (Ton)", min: 10 },
      { label: "টায়ার ≥ 7 Nos", check: "টায়ার সংখ্যা (Nos)", min: 7 },
      { label: "বয়স ≤ 15 বছর", check: "মেশিনের বয়স (বছর)", max: 15 },
    ]
  },
  {
    id: "asphalt_plant",
    name: "Asphalt Mixing Plant (60 TPH+)",
    icon: "🏭",
    required: { qty: 1, phase: "Surface (D20-D28)" },
    specs: [
      { label: "মডেল / ব্র্যান্ড", type: "text", placeholder: "Ammann ABP 120 / MARINI TOP TOWER", required: true },
      { label: "উৎপাদন ক্ষমতা (TPH)", type: "number", placeholder: "80", minVal: 60, maxVal: 200, unit: "TPH" },
      { label: "মিক্সার ক্ষমতা (kg/batch)", type: "number", placeholder: "1200", minVal: 800, maxVal: 2000, unit: "kg" },
      { label: "ড্রায়ার ড্রাম তাপমাত্রা নিয়ন্ত্রণ", type: "select", options: ["Automatic Control", "Manual Control", "Semi-Automatic"] },
      { label: "Aggregate Cold Feed Bin সংখ্যা", type: "number", placeholder: "4", minVal: 3, maxVal: 6, unit: "Nos" },
      { label: "Hot Storage Silo ধারণক্ষমতা (Ton)", type: "number", placeholder: "50", minVal: 30, maxVal: 150, unit: "Ton" },
      { label: "Bitumen Storage Tank (লিটার)", type: "number", placeholder: "25000", minVal: 15000, maxVal: 50000, unit: "liter" },
      { label: "Dust Collection System", type: "select", options: ["Bag Filter (উপযুক্ত)", "Wet Scrubber", "নেই (অনুপযুক্ত)"] },
      { label: "প্ল্যান্ট স্থাপনের জায়গা নিশ্চিত?", type: "select", options: ["হ্যাঁ, স্থান চিহ্নিত", "প্রক্রিয়াধীন", "না"] },
      { label: "সাইট থেকে দূরত্ব (km)", type: "number", placeholder: "2", minVal: 0, maxVal: 15, unit: "km" },
      { label: "Mix Design সম্পন্ন?", type: "select", options: ["হ্যাঁ, Lab Approved", "প্রক্রিয়াধীন", "না"] },
      { label: "অনুমানিত দৈনিক উৎপাদন (MT/day)", type: "number", placeholder: "380", minVal: 200, maxVal: 600, unit: "MT" },
    ],
    criteria: [
      { label: "ক্ষমতা ≥ 60 TPH", check: "উৎপাদন ক্ষমতা (TPH)", min: 60 },
      { label: "Silo ≥ 30 Ton", check: "Hot Storage Silo ধারণক্ষমতা (Ton)", min: 30 },
      { label: "Plant দূরত্ব ≤ 15 km", check: "সাইট থেকে দূরত্ব (km)", max: 15 },
      { label: "Bitumen Tank ≥ 15000L", check: "Bitumen Storage Tank (লিটার)", min: 15000 },
    ]
  },
  {
    id: "asphalt_paver",
    name: "Asphalt Paver / Finisher",
    icon: "🛤️",
    required: { qty: 1, phase: "Surface (D21-D28)" },
    specs: [
      { label: "মডেল / ব্র্যান্ড", type: "text", placeholder: "Vogele Super 1303-3 / Dynapac F1250C", required: true },
      { label: "Paving প্রস্থ সর্বোচ্চ (m)", type: "number", placeholder: "6.0", minVal: 5.5, maxVal: 10, unit: "m" },
      { label: "Screed টাইপ", type: "select", options: ["Tamping & Vibrating (উপযুক্ত)", "Vibrating Only", "Tamping Only"] },
      { label: "Hopper ধারণক্ষমতা (Ton)", type: "number", placeholder: "8", minVal: 5, maxVal: 15, unit: "Ton" },
      { label: "পেভিং গতি (m/min)", type: "number", placeholder: "4", minVal: 2, maxVal: 8, unit: "m/min" },
      { label: "লেয়ার পুরুত্ব নিয়ন্ত্রণ (mm)", type: "number", placeholder: "50", minVal: 30, maxVal: 200, unit: "mm" },
      { label: "Automated Level Control", type: "select", options: ["আছে (Sonic Sensor)", "আছে (Grade Control)", "নেই"] },
      { label: "মেশিনের বয়স (বছর)", type: "number", placeholder: "5", minVal: 0, maxVal: 12, unit: "বছর" },
      { label: "Conveyor ও Auger অবস্থা", type: "select", options: ["সম্পূর্ণ কার্যকর", "মোটামুটি ভালো", "মেরামত দরকার"] },
      { label: "অনুমানিত দৈনিক আউটপুট (sqm/day)", type: "number", placeholder: "3000", minVal: 1500, maxVal: 5000, unit: "sqm" },
    ],
    criteria: [
      { label: "Paving Width ≥ 5.5m", check: "Paving প্রস্থ সর্বোচ্চ (m)", min: 5.5 },
      { label: "Hopper ≥ 5 Ton", check: "Hopper ধারণক্ষমতা (Ton)", min: 5 },
      { label: "বয়স ≤ 12 বছর", check: "মেশিনের বয়স (বছর)", max: 12 },
    ]
  },
  {
    id: "dump_truck",
    name: "Dump Truck (10 Ton)",
    icon: "🚛",
    required: { qty: 4, phase: "Earthwork/Base (D1-D25)" },
    specs: [
      { label: "মডেল / ব্র্যান্ড", type: "text", placeholder: "Hino 700 / FAW J6P / Tata Prima", required: true },
      { label: "পেলোড ধারণক্ষমতা (Ton)", type: "number", placeholder: "10", minVal: 8, maxVal: 15, unit: "Ton" },
      { label: "ভলিউম ধারণক্ষমতা (cum)", type: "number", placeholder: "8", minVal: 6, maxVal: 12, unit: "cum" },
      { label: "ইঞ্জিন ক্ষমতা (HP)", type: "number", placeholder: "340", minVal: 250, maxVal: 450, unit: "HP" },
      { label: "মেশিনের বয়স (বছর)", type: "number", placeholder: "5", minVal: 0, maxVal: 12, unit: "বছর" },
      { label: "Hydraulic Tipper সিস্টেম", type: "select", options: ["সম্পূর্ণ কার্যকর", "সামান্য সমস্যা", "মেরামত দরকার"] },
      { label: "Asphalt Hauling এর জন্য Tarpaulin", type: "select", options: ["আছে", "নেই (Bitumen কাজে অনুপযুক্ত)"] },
      { label: "পার্বত্য পথে গ্রেড অতিক্রমের সক্ষমতা", type: "select", options: ["হ্যাঁ, পাহাড়ি রোড অভিজ্ঞতা আছে", "সমতলে কাজ করেছে", "অনভিজ্ঞ"] },
      { label: "চালকের অভিজ্ঞতা (বছর)", type: "number", placeholder: "5", minVal: 3, maxVal: 30, unit: "বছর" },
      { label: "রেজিস্ট্রেশন ও ফিটনেস সার্টিফিকেট", type: "select", options: ["হালনাগাদ আছে", "মেয়াদ শেষ — নবায়ন দরকার", "নেই"] },
    ],
    criteria: [
      { label: "ধারণক্ষমতা ≥ 8 Ton", check: "পেলোড ধারণক্ষমতা (Ton)", min: 8 },
      { label: "ভলিউম ≥ 6 cum", check: "ভলিউম ধারণক্ষমতা (cum)", min: 6 },
      { label: "HP ≥ 250", check: "ইঞ্জিন ক্ষমতা (HP)", min: 250 },
      { label: "বয়স ≤ 12 বছর", check: "মেশিনের বয়স (বছর)", max: 12 },
    ]
  },
  {
    id: "water_tanker",
    name: "Water Tanker (8000L+)",
    icon: "🚒",
    required: { qty: 1, phase: "Base (D7-D22)" },
    specs: [
      { label: "ট্যাংকের ধারণক্ষমতা (লিটার)", type: "number", placeholder: "8000", minVal: 6000, maxVal: 15000, unit: "লিটার" },
      { label: "পাম্পের ক্ষমতা (LPM)", type: "number", placeholder: "500", minVal: 300, maxVal: 1000, unit: "LPM" },
      { label: "স্প্রে নজেল সিস্টেম", type: "select", options: ["পেছনের স্প্রে বার আছে (Rear Spray Bar)", "সাধারণ নজেল", "নেই"] },
      { label: "ফ্লো কন্ট্রোল ভালভ", type: "select", options: ["ভালো কার্যকর", "মোটামুটি", "মেরামত দরকার"] },
      { label: "ট্যাংকের উপাদান", type: "select", options: ["Stainless Steel", "MS (Mild Steel)", "HDPE Plastic"] },
      { label: "মেশিনের বয়স (বছর)", type: "number", placeholder: "5", minVal: 0, maxVal: 15, unit: "বছর" },
      { label: "পানি উত্তোলনের ব্যবস্থা", type: "select", options: ["নিজস্ব পাম্প আছে", "বাইরের পাম্প দরকার"] },
      { label: "পার্বত্য পথে চলার সক্ষমতা", type: "select", options: ["হ্যাঁ", "না (সমতলের জন্য)"] },
    ],
    criteria: [
      { label: "ট্যাংক ≥ 6000L", check: "ট্যাংকের ধারণক্ষমতা (লিটার)", min: 6000 },
      { label: "পাম্প ≥ 300 LPM", check: "পাম্পের ক্ষমতা (LPM)", min: 300 },
      { label: "বয়স ≤ 15 বছর", check: "মেশিনের বয়স (বছর)", max: 15 },
    ]
  },
  {
    id: "concrete_mixer",
    name: "Concrete Mixer (0.5m³+)",
    icon: "🔄",
    required: { qty: 2, phase: "Drain (D10-D25)" },
    specs: [
      { label: "মডেল / ব্র্যান্ড", type: "text", placeholder: "Ajax / Schwing Stetter / Local Make" },
      { label: "মিক্সারের ধারণক্ষমতা (m³)", type: "number", placeholder: "0.5", minVal: 0.3, maxVal: 1.0, unit: "m³" },
      { label: "ড্রামের গতি (RPM)", type: "number", placeholder: "15", minVal: 10, maxVal: 25, unit: "RPM" },
      { label: "পাওয়ার সোর্স", type: "select", options: ["বৈদ্যুতিক মোটর (3-phase)", "ডিজেল ইঞ্জিন চালিত", "পেট্রোল ইঞ্জিন"] },
      { label: "ড্রামের অবস্থা", type: "select", options: ["ভালো (Fins/Blades ঠিক আছে)", "মোটামুটি", "মেরামত দরকার"] },
      { label: "Water Measuring System", type: "select", options: ["আছে", "নেই (ম্যানুয়াল)"] },
      { label: "মেশিনের বয়স (বছর)", type: "number", placeholder: "3", minVal: 0, maxVal: 10, unit: "বছর" },
      { label: "অনুমানিত দৈনিক উৎপাদন (cum/day)", type: "number", placeholder: "20", minVal: 10, maxVal: 40, unit: "cum" },
    ],
    criteria: [
      { label: "ধারণক্ষমতা ≥ 0.3 m³", check: "মিক্সারের ধারণক্ষমতা (m³)", min: 0.3 },
      { label: "বয়স ≤ 10 বছর", check: "মেশিনের বয়স (বছর)", max: 10 },
    ]
  },
  {
    id: "plate_compactor",
    name: "Plate Compactor (সরু স্থান)",
    icon: "🔩",
    required: { qty: 3, phase: "Drain/HBB (D4-D23)" },
    specs: [
      { label: "মডেল / ব্র্যান্ড", type: "text", placeholder: "Wacker Neuson VP1550 / Mikasa MVC-88" },
      { label: "প্লেটের আকার (mm × mm)", type: "text", placeholder: "500 × 700" },
      { label: "কম্প্যাকশন বল (kN)", type: "number", placeholder: "18", minVal: 10, maxVal: 30, unit: "kN" },
      { label: "ভাইব্রেশন ফ্রিকোয়েন্সি (Hz)", type: "number", placeholder: "90", minVal: 60, maxVal: 100, unit: "Hz" },
      { label: "পাওয়ার সোর্স", type: "select", options: ["পেট্রোল ইঞ্জিন", "ডিজেল ইঞ্জিন", "বৈদ্যুতিক"] },
      { label: "মেশিনের বয়স (বছর)", type: "number", placeholder: "3", minVal: 0, maxVal: 8, unit: "বছর" },
      { label: "কম্প্যাকশন গভীরতা সক্ষমতা (mm)", type: "number", placeholder: "250", minVal: 150, maxVal: 400, unit: "mm" },
      { label: "ড্রেন সাইডে ব্যবহারযোগ্য?", type: "select", options: ["হ্যাঁ, সাইজ উপযুক্ত", "না, বড় সাইজ"] },
    ],
    criteria: [
      { label: "বল ≥ 10 kN", check: "কম্প্যাকশন বল (kN)", min: 10 },
      { label: "Frequency ≥ 60 Hz", check: "ভাইব্রেশন ফ্রিকোয়েন্সি (Hz)", min: 60 },
      { label: "বয়স ≤ 8 বছর", check: "মেশিনের বয়স (বছর)", max: 8 },
    ]
  },
  {
    id: "generator",
    name: "Generator (25 KVA+)",
    icon: "⚡",
    required: { qty: 1, phase: "সমগ্র প্রজেক্ট (D1-D30)" },
    specs: [
      { label: "মডেল / ব্র্যান্ড", type: "text", placeholder: "Cummins C28D5 / Perkins 1104A" },
      { label: "রেটেড ক্ষমতা (KVA)", type: "number", placeholder: "30", minVal: 25, maxVal: 100, unit: "KVA" },
      { label: "ইঞ্জিনের ধরন", type: "select", options: ["Diesel (উপযুক্ত)", "Petrol", "Gas"] },
      { label: "ভোল্টেজ আউটপুট (V)", type: "select", options: ["220V / 380V (3-phase)", "220V (1-phase)", "Custom"] },
      { label: "ফুয়েল ট্যাংক ধারণক্ষমতা (লিটার)", type: "number", placeholder: "100", minVal: 50, maxVal: 300, unit: "লিটার" },
      { label: "অনুমানিত জ্বালানি খরচ (L/hr)", type: "number", placeholder: "6", minVal: 3, maxVal: 15, unit: "L/hr" },
      { label: "Automatic Voltage Regulator (AVR)", type: "select", options: ["আছে", "নেই"] },
      { label: "মেশিনের বয়স (বছর)", type: "number", placeholder: "4", minVal: 0, maxVal: 12, unit: "বছর" },
      { label: "শেষ সার্ভিসিং তারিখ", type: "date", placeholder: "" },
    ],
    criteria: [
      { label: "ক্ষমতা ≥ 25 KVA", check: "রেটেড ক্ষমতা (KVA)", min: 25 },
      { label: "বয়স ≤ 12 বছর", check: "মেশিনের বয়স (বছর)", max: 12 },
    ]
  },
];

// ─── PRE-ASSESSMENT DATA (existing) ───
const PRE_ASSESSMENT_SECTIONS = [
  { id: "site_general", title: "১. সাইটের সাধারণ তথ্য", icon: "📍", color: "#111", items: [
    { label: "প্রজেক্টের নাম", type: "text", placeholder: "Border Road Construction..." },
    { label: "সাইটের অবস্থান (GPS)", type: "text", placeholder: "22.7345° N, 92.3412° E" },
    { label: "ইউনিয়ন / উপজেলা / জেলা", type: "text", placeholder: "রাঙামাটি সদর..." },
    { label: "সড়কের শুরু পয়েন্ট (Chainage)", type: "text", placeholder: "0+000" },
    { label: "সড়কের শেষ পয়েন্ট (Chainage)", type: "text", placeholder: "1+000" },
    { label: "পরিদর্শনের তারিখ", type: "date", placeholder: "" },
    { label: "পরিদর্শনকারী প্রকৌশলীর নাম", type: "text", placeholder: "নাম ও পদবী" },
    { label: "আবহাওয়ার অবস্থা", type: "select", options: ["শুষ্ক ও রোদেলা", "মেঘলা", "হালকা বৃষ্টি", "ভারী বৃষ্টি"] },
    { label: "মৌসুম", type: "select", options: ["শুষ্ক মৌসুম (নভেম্বর-মার্চ)", "আর্দ্র মৌসুম (এপ্রিল-জুন)", "বর্ষা মৌসুম (জুলাই-অক্টোবর)"] },
    { label: "বিদ্যমান সড়কের ধরন", type: "select", options: ["কাঁচা মাটির রাস্তা", "পুরনো WBM", "পুরনো বিটুমিনাস", "নতুন নির্মাণ"] },
  ]},
  { id: "terrain", title: "২. ভূমি ও টপোগ্রাফি", icon: "⛰️", color: "#222", items: [
    { label: "ভূমির প্রকৃতি", type: "select", options: ["পার্বত্য (Hilly)", "পাহাড়ি (Undulating)", "সমতল (Flat)", "মিশ্র (Mixed)"] },
    { label: "গড় ঢাল (Average Grade %)", type: "number", placeholder: "3-8" },
    { label: "সর্বোচ্চ ঢাল (Max Grade %)", type: "number", placeholder: "10-15" },
    { label: "Hill Cut পরিমাণ (অনুমানিত m)", type: "number", placeholder: "500" },
    { label: "Embankment ভরাট প্রয়োজন?", type: "select", options: ["হ্যাঁ", "না", "কিছু কিছু জায়গায়"] },
    { label: "জলাবদ্ধতার সম্ভাবনা", type: "select", options: ["বেশি", "মাঝারি", "কম", "নেই"] },
    { label: "নদী / খাল অতিক্রম?", type: "select", options: ["আছে (ব্রিজ/কালভার্ট দরকার)", "নেই"] },
    { label: "ভূমিধস ঝুঁকি", type: "select", options: ["উচ্চ ঝুঁকি", "মাঝারি ঝুঁকি", "কম ঝুঁকি", "নেই"] },
    { label: "উল্লেখযোগ্য বাধা", type: "textarea", placeholder: "গাছ, ঘরবাড়ি, বৈদ্যুতিক খুঁটি..." },
    { label: "ভূমি ব্যবহার (Land Use)", type: "select", options: ["বন ও পাহাড়", "কৃষিজমি", "আবাসিক এলাকা সংলগ্ন", "মিশ্র"] },
  ]},
  { id: "soil", title: "৩. মাটি পরীক্ষা ও Subgrade", icon: "🪨", color: "#333", items: [
    { label: "মাটির ধরন (Visual Classification)", type: "select", options: ["Sandy Soil (বালুকাময়)", "Clayey Soil (এঁটেল)", "Silty Soil (পলিমাটি)", "Gravelly Soil (নুড়িমাটি)", "Rock (পাথর)", "Mixed"] },
    { label: "বিদ্যমান CBR (মাঠ পরীক্ষা/অনুমান %)", type: "number", placeholder: "5" },
    { label: "মাটির রং (Soil Color)", type: "select", options: ["লাল (Laterite)", "হলুদ", "বাদামি", "কালো (Black Cotton)", "ধূসর"] },
    { label: "আর্দ্রতার মাত্রা", type: "select", options: ["শুষ্ক", "সামান্য আর্দ্র", "আর্দ্র", "অতিরিক্ত আর্দ্র"] },
    { label: "মাটি কম্প্যাকশনযোগ্য?", type: "select", options: ["হ্যাঁ, উপযুক্ত", "হ্যাঁ, প্রক্রিয়াকরণ দরকার", "না, প্রতিস্থাপন দরকার"] },
    { label: "Soft Spot / Unstable Zone আছে?", type: "select", options: ["হ্যাঁ", "না"] },
    { label: "CBR Test নমুনা সংগ্রহ", type: "select", options: ["সংগ্রহ করা হয়েছে", "প্রয়োজন", "আগের রিপোর্ট আছে"] },
    { label: "Plasticity Index (PI) অনুমান", type: "select", options: ["PI < 10 (ভালো)", "PI 10-20 (মাঝারি)", "PI > 20 (খারাপ)"] },
    { label: "Rock বা Hard Layer গভীরতা (m)", type: "number", placeholder: "2.5" },
    { label: "মাটি পরীক্ষার রিপোর্ট নম্বর", type: "text", placeholder: "Lab Report No." },
  ]},
  { id: "drainage", title: "৪. ড্রেনেজ ও জলনিষ্কাশন", icon: "🌊", color: "#444", items: [
    { label: "বিদ্যমান ড্রেনের অবস্থা", type: "select", options: ["ভালো", "আংশিক ক্ষতিগ্রস্ত", "সম্পূর্ণ নষ্ট", "নেই"] },
    { label: "Hill Side ড্রেন ধরন", type: "select", options: ["U-Type Brick Drain", "L-Type Brick Drain", "CC Lined Drain", "নির্ধারণ করতে হবে"] },
    { label: "Valley Side ড্রেন ধরন", type: "select", options: ["L-Type (Valley Side)", "Open Channel", "পরিস্থিতি দেখে"] },
    { label: "Catch Water Drain প্রয়োজন?", type: "select", options: ["হ্যাঁ", "না", "কিছু জায়গায়"] },
    { label: "বন্যার ঝুঁকি আছে?", type: "select", options: ["আছে", "নেই"] },
    { label: "Cross Drainage দরকার?", type: "select", options: ["হ্যাঁ", "না"] },
    { label: "বিদ্যমান কালভার্টের অবস্থা", type: "select", options: ["ভালো", "মেরামতযোগ্য", "প্রতিস্থাপন দরকার", "নেই"] },
    { label: "Seepage / Spring Water সমস্যা", type: "select", options: ["আছে", "নেই"] },
    { label: "Drain Outlet সুবিধা", type: "select", options: ["পর্যাপ্ত আছে", "তৈরি করতে হবে", "সমস্যা আছে"] },
    { label: "Drain খননের মাটির ধরন", type: "select", options: ["সহজ (Soft Soil)", "মাঝারি", "কঠিন (Rock)"] },
  ]},
  { id: "materials", title: "৫. মালামালের প্রাপ্যতা", icon: "🏗️", color: "#555", items: [
    { label: "নিকটতম বালু উৎস (দূরত্ব km)", type: "text", placeholder: "কাপ্তাই নদী, ১৫ km" },
    { label: "বালুর বাজার মূল্য (৳/cum)", type: "number", placeholder: "900" },
    { label: "নিকটতম ইটভাটা (দূরত্ব km)", type: "text", placeholder: "রাঙামাটি ইটভাটা, ২০ km" },
    { label: "ইটের বর্তমান মূল্য (৳/হাজার)", type: "number", placeholder: "15000" },
    { label: "নিকটতম সিমেন্ট ডিলার (দূরত্ব km)", type: "text", placeholder: "৫ km" },
    { label: "সিমেন্টের মূল্য (৳/bag)", type: "number", placeholder: "550" },
    { label: "Stone Chips / Aggregate উৎস (দূরত্ব km)", type: "text", placeholder: "৩০ km" },
    { label: "Aggregate মূল্য (৳/cum)", type: "number", placeholder: "4500" },
    { label: "বিটুমেন সরবরাহকারী (দূরত্ব km)", type: "text", placeholder: "ঢাকা BPC ডিপো, ৩৫০ km" },
    { label: "মালামাল পরিবহন সড়ক অবস্থা", type: "select", options: ["ভালো", "মাঝারি", "খারাপ", "অত্যন্ত খারাপ"] },
    { label: "পানির উৎস (কম্প্যাকশনের জন্য)", type: "text", placeholder: "নিকটতম নদী/খাল" },
    { label: "Sub-Base Material উৎস (দূরত্ব km)", type: "text", placeholder: "স্থানীয় পাহাড়, ১০ km" },
  ]},
  { id: "machinery_access", title: "৬. মেশিনারিজ প্রবেশযোগ্যতা", icon: "⚙️", color: "#444", items: [
    { label: "ভারী যানবাহন প্রবেশ পথ", type: "select", options: ["সরাসরি প্রবেশ সম্ভব", "বিকল্প পথে", "পথ তৈরি করতে হবে", "অত্যন্ত কঠিন"] },
    { label: "নিকটতম ভারী যানবাহন প্রবেশ পয়েন্ট (km)", type: "number", placeholder: "5" },
    { label: "সংকীর্ণ রাস্তা / সেতু বাধা", type: "select", options: ["আছে", "নেই"] },
    { label: "সেতুর সর্বোচ্চ টনেজ (ton)", type: "number", placeholder: "20" },
    { label: "Excavator সাইটে নামার জায়গা", type: "select", options: ["পর্যাপ্ত", "সীমিত", "বিশেষ ব্যবস্থা লাগবে"] },
    { label: "Asphalt Plant স্থাপনের জায়গা", type: "select", options: ["পর্যাপ্ত ফ্ল্যাট এলাকা আছে", "সীমিত", "পার্শ্ববর্তী এলাকায় স্থাপন করতে হবে"] },
    { label: "Asphalt Plant থেকে সাইটের দূরত্ব (km)", type: "number", placeholder: "2" },
    { label: "Dump Truck চলাচলের পথ", type: "select", options: ["একমুখী", "দ্বিমুখী", "বিকল্প রুট দরকার"] },
    { label: "নিরাপত্তা বাধা", type: "select", options: ["আছে", "নেই"] },
    { label: "Mobilization সময়কাল (দিন)", type: "number", placeholder: "2-3" },
  ]},
  { id: "environmental", title: "৭. পরিবেশগত বিষয়", icon: "🌿", color: "#222", items: [
    { label: "পরিবেশ ছাড়পত্র (ECC) আছে?", type: "select", options: ["আছে", "প্রক্রিয়াধীন", "নেই"] },
    { label: "সংরক্ষিত বন এলাকার মধ্যে?", type: "select", options: ["হ্যাঁ", "না", "কিছু অংশ"] },
    { label: "নদী বা জলাশয়ের কাছে?", type: "select", options: ["১০০m এর মধ্যে", "১০০-৫০০m দূরে", "৫০০m এর বেশি"] },
    { label: "Erosion নিয়ন্ত্রণ ব্যবস্থা দরকার?", type: "select", options: ["হ্যাঁ", "মাঝারি", "না"] },
    { label: "বর্জ্য মাটি ফেলার জায়গা", type: "text", placeholder: "নির্দিষ্ট স্থান উল্লেখ করুন" },
    { label: "EIA করা হয়েছে?", type: "select", options: ["হ্যাঁ", "না", "প্রয়োজন নেই"] },
    { label: "ভূমি অধিগ্রহণ সম্পন্ন?", type: "select", options: ["সম্পন্ন", "আংশিক", "প্রক্রিয়াধীন", "শুরু হয়নি"] },
    { label: "স্থানীয় সম্প্রদায়ের সহযোগিতা", type: "select", options: ["পূর্ণ সহযোগিতা", "আংশিক", "বিরোধিতার সম্ভাবনা"] },
    { label: "স্থানীয় নিরাপত্তা পরিস্থিতি", type: "select", options: ["শান্তিপূর্ণ", "সতর্কতা প্রয়োজন", "নিরাপত্তা বাহিনী লাগবে"] },
    { label: "সার্বিক মন্তব্য ও সুপারিশ", type: "textarea", placeholder: "বিস্তারিত পর্যবেক্ষণ..." },
  ]},
];

const PHOTO_CHECKLIST = [
  "সড়কের শুরু ও শেষ পয়েন্টের ছবি",
  "বিদ্যমান সড়কের অবস্থার ছবি (প্রতি ২০০m এ)",
  "Subgrade মাটির ধরনের ক্লোজআপ ছবি",
  "Hill Side ও Valley Side এর দৃশ্য",
  "বিদ্যমান Drain এর অবস্থা",
  "বিদ্যমান কালভার্টের ছবি",
  "মালামাল উৎসের পথ ও রাস্তার অবস্থা",
  "মেশিনারি প্রবেশপথের ছবি",
  "ভূমিধস বা Soft Spot চিহ্নিত স্থান",
  "GPS / Chainage মার্কিং ছবি",
  "পানির উৎস (নদী / খাল)",
  "স্থানীয় নির্মাণ সামগ্রীর বাজারের ছবি",
  "সাইট টিম গ্রুপ ছবি",
];

const MEASUREMENT_CHECKLIST = [
  { item: "বিদ্যমান সড়কের প্রস্থ", tool: "Measuring Tape / Disto", unit: "m", freq: "প্রতি ৫০m" },
  { item: "ভূমির Longitudinal Profile", tool: "Auto Level / Total Station", unit: "m", freq: "প্রতি ১০m" },
  { item: "Cross Section Survey", tool: "Total Station", unit: "sqm", freq: "প্রতি ২০m" },
  { item: "Drain গভীরতা ও প্রস্থ", tool: "Measuring Tape", unit: "m", freq: "নমুনা স্থানে" },
  { item: "CBR Test in-situ (DCP)", tool: "DCP", unit: "mm/blow", freq: "প্রতি ২০০m" },
  { item: "Soil Sample Collection", tool: "Auger / Trial Pit", unit: "kg", freq: "প্রতি ৫০০m" },
  { item: "Grade / Slope Measurement", tool: "Clinometer", unit: "%", freq: "প্রতি ৫০m" },
  { item: "GPS Coordinates (প্রতি Feature)", tool: "GPS Device", unit: "°", freq: "প্রতিটি কাঠামো" },
  { item: "Culvert Opening Size", tool: "Measuring Tape", unit: "m×m", freq: "প্রতিটি কালভার্ট" },
  { item: "Water Source Distance", tool: "GPS / Tape", unit: "m", freq: "সকল উৎস" },
];

// ─── STYLES ───
const S = {
  page: { minHeight: "100vh", background: "#f7f7f7", color: "#1a1a1a", fontFamily: "'Segoe UI',Arial,sans-serif" },
  header: { background: "#111", color: "#fff", padding: "1rem 1.5rem", borderBottom: "3px solid #444" },
  tabBar: { background: "#fff", borderBottom: "2px solid #ddd", padding: "0 0.5rem", display: "flex", overflowX: "auto", position: "sticky", top: 0, zIndex: 10 },
  tabBtn: (a) => ({ padding: "0.6rem 0.8rem", fontSize: "0.73rem", fontWeight: a ? "700" : "500", background: "transparent", border: "none", borderBottom: a ? "3px solid #111" : "3px solid transparent", color: a ? "#111" : "#666", cursor: "pointer", whiteSpace: "nowrap", marginBottom: "-2px" }),
  body: { maxWidth: "1280px", margin: "0 auto", padding: "1.1rem" },
  card: { background: "#fff", border: "1px solid #e0e0e0", borderRadius: "5px", padding: "1rem", marginBottom: "1rem" },
  cardTitle: { fontSize: "0.92rem", fontWeight: "700", color: "#111", marginBottom: "0.7rem", paddingBottom: "0.4rem", borderBottom: "2px solid #e0e0e0" },
  table: { width: "100%", borderCollapse: "collapse", fontSize: "0.73rem" },
  th: { background: "#111", color: "#fff", padding: "0.45rem 0.5rem", textAlign: "center", fontWeight: "600", whiteSpace: "nowrap" },
  thL: { background: "#111", color: "#fff", padding: "0.45rem 0.5rem", textAlign: "left", fontWeight: "600" },
  td: { padding: "0.4rem 0.5rem", textAlign: "center", borderBottom: "1px solid #ebebeb", color: "#333", verticalAlign: "top" },
  tdL: { padding: "0.4rem 0.5rem", textAlign: "left", borderBottom: "1px solid #ebebeb", color: "#333", verticalAlign: "top" },
  tdB: { padding: "0.4rem 0.5rem", textAlign: "right", borderBottom: "1px solid #ebebeb", fontWeight: "700", color: "#111" },
  totalRow: { background: "#f0f0f0" },
  grandRow: { background: "#111", color: "#fff" },
  statGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(155px,1fr))", gap: "0.6rem", marginBottom: "0.9rem" },
  statCard: { background: "#fff", border: "1px solid #ddd", borderRadius: "4px", padding: "0.75rem", borderTop: "3px solid #111" },
  infoBox: { background: "#f5f5f5", border: "1px solid #ddd", borderRadius: "3px", padding: "0.55rem 0.85rem", fontSize: "0.72rem", color: "#444", lineHeight: "1.7" },
  input: { background: "#fff", border: "2px solid #111", borderRadius: "3px", padding: "0.28rem 0.45rem", color: "#111", fontWeight: "700", width: "4.5rem", textAlign: "center", fontSize: "0.95rem" },
  secHeader: (color) => ({ background: color, color: "#fff", padding: "0.7rem 1rem", borderRadius: "5px 5px 0 0", fontWeight: "700", fontSize: "0.88rem", display: "flex", alignItems: "center", gap: "0.5rem" }),
  secBody: { background: "#fff", border: "1px solid #e0e0e0", borderTop: "none", borderRadius: "0 0 5px 5px", padding: "0.9rem", marginBottom: "1rem" },
  fieldGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(260px,1fr))", gap: "0.65rem" },
  fieldLabel: { fontSize: "0.71rem", fontWeight: "600", color: "#333", marginBottom: "0.22rem" },
  fieldInput: { width: "100%", border: "1px solid #ccc", borderRadius: "3px", padding: "0.36rem 0.5rem", fontSize: "0.74rem", color: "#111", background: "#fafafa", boxSizing: "border-box" },
  fieldTextarea: { width: "100%", border: "1px solid #ccc", borderRadius: "3px", padding: "0.36rem 0.5rem", fontSize: "0.74rem", color: "#111", background: "#fafafa", minHeight: "65px", boxSizing: "border-box", resize: "vertical" },
  checkItem: (checked) => ({ display: "flex", alignItems: "flex-start", gap: "0.5rem", padding: "0.4rem 0.5rem", borderRadius: "3px", marginBottom: "0.3rem", background: checked ? "#f0f0f0" : "#fff", border: checked ? "1px solid #ccc" : "1px solid #e8e8e8", cursor: "pointer" }),
  checkbox: { marginTop: "2px", cursor: "pointer", width: "14px", height: "14px", flexShrink: 0 },
  progressBar: () => ({ height: "7px", background: "#e0e0e0", borderRadius: "4px", overflow: "hidden", marginBottom: "0.35rem" }),
  progressFill: (pct) => ({ height: "100%", background: pct >= 80 ? "#111" : pct >= 50 ? "#555" : "#999", width: `${pct}%`, borderRadius: "4px", transition: "width 0.3s" }),
  pill: (t) => ({ display: "inline-block", padding: "0.1rem 0.4rem", borderRadius: "2px", fontSize: "0.65rem", fontWeight: "700", background: t === "দক্ষ" ? "#222" : t === "অর্ধদক্ষ" ? "#555" : "#888", color: "#fff" }),
  phasePill: (p) => { const c = { Earthwork: "#222", "Earthwork/Base": "#333", Base: "#444", Drain: "#666", "Drain/HBB": "#777", Surface: "#555", General: "#999" }; return { display: "inline-block", padding: "0.1rem 0.4rem", borderRadius: "2px", fontSize: "0.63rem", fontWeight: "600", background: c[p] || "#777", color: "#fff" }; },
  // Machine spec styles
  machineCard: (status) => ({
    border: `2px solid ${status === "pass" ? "#333" : status === "fail" ? "#999" : "#ddd"}`,
    borderRadius: "5px", marginBottom: "0.75rem", overflow: "hidden",
  }),
  machineCardHead: (status) => ({
    background: status === "pass" ? "#111" : status === "fail" ? "#555" : "#333",
    color: "#fff", padding: "0.6rem 0.9rem", display: "flex", justifyContent: "space-between", alignItems: "center",
  }),
  specGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(240px,1fr))", gap: "0.55rem", padding: "0.9rem" },
  specField: { },
  specLabel: { fontSize: "0.68rem", fontWeight: "600", color: "#444", marginBottom: "0.18rem" },
  specInput: (ok) => ({ width: "100%", border: `1px solid ${ok === false ? "#aaa" : ok === true ? "#555" : "#ccc"}`, borderRadius: "3px", padding: "0.33rem 0.45rem", fontSize: "0.73rem", color: "#111", background: ok === false ? "#f8f8f8" : ok === true ? "#fafafa" : "#fafafa", boxSizing: "border-box" }),
  criteriaBox: { padding: "0.6rem 0.9rem", borderTop: "1px solid #ebebeb", background: "#fafafa", display: "flex", flexWrap: "wrap", gap: "0.4rem" },
  criteriaTag: (pass) => ({ padding: "0.15rem 0.5rem", borderRadius: "3px", fontSize: "0.65rem", fontWeight: "700", background: pass ? "#111" : "#888", color: "#fff", display: "flex", alignItems: "center", gap: "0.25rem" }),
  passTag: { background: "#111", color: "#fff", padding: "0.12rem 0.5rem", borderRadius: "3px", fontSize: "0.65rem", fontWeight: "700" },
  failTag: { background: "#888", color: "#fff", padding: "0.12rem 0.5rem", borderRadius: "3px", fontSize: "0.65rem", fontWeight: "700" },
  summaryTag: (s) => ({ display: "inline-flex", alignItems: "center", gap: "0.25rem", padding: "0.18rem 0.55rem", borderRadius: "3px", fontSize: "0.68rem", fontWeight: "700", background: s === "✔ PASS" ? "#111" : s === "✘ FAIL" ? "#666" : "#aaa", color: "#fff" }),
};

// ─── SHARED COMPONENTS ───
function Tbl({ heads, rows, totalRow, grandRow }) {
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={S.table}>
        <thead><tr>{heads.map((h, i) => <th key={i} style={h.left ? S.thL : S.th}>{h.label}</th>)}</tr></thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} style={i % 2 === 1 ? { background: "#fafafa" } : {}}>
              {row.map((cell, j) => {
                if (cell && typeof cell === "object" && cell.jsx) return <td key={j} style={S.td}>{cell.jsx}</td>;
                if (cell && typeof cell === "object" && cell.bold) return <td key={j} style={S.tdB}>{cell.val}</td>;
                return <td key={j} style={j === 0 ? S.tdL : S.td}>{cell}</td>;
              })}
            </tr>
          ))}
          {totalRow && <tr style={S.totalRow}>{totalRow.map((c, j) => <td key={j} style={{ ...S.td, fontWeight: "700", textAlign: j === 0 ? "left" : "right" }}>{c}</td>)}</tr>}
          {grandRow && <tr style={S.grandRow}>{grandRow.map((c, j) => <td key={j} style={{ padding: "0.5rem", color: "#fff", fontWeight: "700", textAlign: j === 0 ? "left" : "right" }}>{c}</td>)}</tr>}
        </tbody>
      </table>
    </div>
  );
}

function StatCard({ label, value, sub }) {
  return (
    <div style={S.statCard}>
      <div style={{ fontSize: "1.15rem", fontWeight: "700" }}>{value}</div>
      {sub && <div style={{ fontSize: "0.72rem", color: "#555" }}>{sub}</div>}
      <div style={{ fontSize: "0.68rem", color: "#888", marginTop: "0.1rem" }}>{label}</div>
    </div>
  );
}

function BarChart({ data }) {
  const max = Math.max(...data.map(d => d.value), 1);
  return (
    <div>
      {data.map((d, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.3rem" }}>
          <div style={{ width: "145px", fontSize: "0.68rem", color: "#444", textAlign: "right", flexShrink: 0 }}>{d.label}</div>
          <div style={{ flex: 1, background: "#ebebeb", borderRadius: "2px", height: "16px" }}>
            <div style={{ width: `${(d.value / max) * 100}%`, height: "100%", background: d.color || "#333", borderRadius: "2px", minWidth: d.value > 0 ? "4px" : "0", display: "flex", alignItems: "center", paddingLeft: "4px" }}>
              {d.value > 0 && <span style={{ fontSize: "0.6rem", color: "#fff", fontWeight: "700" }}>{d.fmt}</span>}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function MachineGantt({ machines }) {
  return (
    <div style={{ overflowX: "auto" }}>
      <div style={{ minWidth: "860px" }}>
        <div style={{ display: "flex", paddingLeft: "185px", marginBottom: "3px" }}>
          {Array.from({ length: 30 }, (_, i) => (
            <div key={i} style={{ flex: 1, textAlign: "center", fontSize: "0.58rem", color: "#888", borderLeft: i % 7 === 0 ? "1px solid #ddd" : "none" }}>{i + 1}</div>
          ))}
        </div>
        {machines.map((m, mi) => {
          const phaseBg = { Earthwork: "#222", "Earthwork/Base": "#333", Base: "#444", Drain: "#666", "Drain/HBB": "#777", Surface: "#555", General: "#999" };
          const bg = phaseBg[m.phase] || "#555";
          return (
            <div key={mi} style={{ display: "flex", alignItems: "center", marginBottom: "3px" }}>
              <div style={{ width: "185px", fontSize: "0.65rem", paddingRight: "5px", textAlign: "right", color: "#333", flexShrink: 0 }}>{m.name} <span style={{ color: "#888" }}>×{m.needed}</span></div>
              <div style={{ flex: 1, position: "relative", height: "17px", background: "#f0f0f0", borderRadius: "2px" }}>
                {m.arrive > 1 && <div style={{ position: "absolute", left: 0, width: `${((m.arrive - 1) / 30) * 100}%`, height: "100%", background: "#e8e8e8" }} />}
                <div style={{ position: "absolute", left: `${((m.arrive - 1) / 30) * 100}%`, width: `${(m.days / 30) * 100}%`, height: "100%", background: bg, borderRadius: "2px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.58rem", color: "#fff", fontWeight: "600", overflow: "hidden", whiteSpace: "nowrap" }}>D{m.arrive}→D{m.depart}</div>
                {m.depart < 30 && <div style={{ position: "absolute", left: `${(m.depart / 30) * 100}%`, width: `${((30 - m.depart) / 30) * 100}%`, height: "100%", background: "#e8e8e8" }} />}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── MACHINE SPEC CHECK COMPONENT ───
function MachineSpecCheck({ specData, onChange }) {
  const [expanded, setExpanded] = useState({});

  const getVal = (machId, label) => specData[`${machId}_${label}`] || "";
  const setVal = (machId, label, val) => onChange(`${machId}_${label}`, val);

  const checkCriteria = (mach) => {
    return mach.criteria.map(c => {
      const val = parseFloat(getVal(mach.id, c.check));
      if (isNaN(val)) return { ...c, status: "pending" };
      if (c.min !== undefined && val < c.min) return { ...c, status: "fail" };
      if (c.max !== undefined && val > c.max) return { ...c, status: "fail" };
      return { ...c, status: "pass" };
    });
  };

  const getMachineStatus = (mach) => {
    const results = checkCriteria(mach);
    const filled = mach.specs.filter(s => getVal(mach.id, s.label) !== "").length;
    if (filled === 0) return "empty";
    if (results.some(r => r.status === "fail")) return "fail";
    if (results.some(r => r.status === "pending")) return "partial";
    return "pass";
  };

  const totalPassed = MACHINE_SPECS.filter(m => getMachineStatus(m) === "pass").length;
  const totalFilled = MACHINE_SPECS.filter(m => getMachineStatus(m) !== "empty").length;

  return (
    <div>
      {/* Summary */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(160px,1fr))", gap: "0.6rem", marginBottom: "1rem" }}>
        <StatCard label="মোট মেশিন প্রকার" value={MACHINE_SPECS.length + " টি"} />
        <StatCard label="তথ্য পূরণ হয়েছে" value={totalFilled + "/" + MACHINE_SPECS.length} />
        <StatCard label="স্পেসিফিকেশন পাস" value={totalPassed + " টি"} sub="সকল criteria পূরণ" />
        <StatCard label="পর্যালোচনা দরকার" value={(totalFilled - totalPassed) + " টি"} sub="Fail বা Pending" />
      </div>

      {/* Quick Summary Table */}
      <div style={S.card}>
        <div style={S.cardTitle}>মেশিন স্পেসিফিকেশন সারসংক্ষেপ</div>
        <Tbl
          heads={[
            { label: "মেশিন", left: true },
            { label: "প্রয়োজনীয় সংখ্যা" },
            { label: "Phase" },
            { label: "Criteria পাস" },
            { label: "পূরণকৃত তথ্য" },
            { label: "সামগ্রিক অবস্থা" },
          ]}
          rows={MACHINE_SPECS.map(m => {
            const results = checkCriteria(m);
            const passed = results.filter(r => r.status === "pass").length;
            const filled = m.specs.filter(s => getVal(m.id, s.label) !== "").length;
            const status = getMachineStatus(m);
            const statusText = status === "pass" ? "✔ PASS" : status === "fail" ? "✘ FAIL" : status === "partial" ? "⚠ আংশিক" : "— তথ্য নেই";
            return [
              m.icon + " " + m.name,
              m.required.qty + " টি",
              { jsx: <span style={S.phasePill(m.required.phase.split(" ")[0])}>{m.required.phase}</span> },
              passed + "/" + results.length,
              filled + "/" + m.specs.length,
              { jsx: <span style={S.summaryTag(statusText)}>{statusText}</span> },
            ];
          })}
        />
      </div>

      {/* Individual Machine Cards */}
      <div style={S.card}>
        <div style={S.cardTitle}>মেশিন ভিত্তিক স্পেসিফিকেশন চেক (বিস্তারিত)</div>
        {MACHINE_SPECS.map((mach) => {
          const status = getMachineStatus(mach);
          const results = checkCriteria(mach);
          const isOpen = expanded[mach.id] !== false;
          const filled = mach.specs.filter(s => getVal(mach.id, s.label) !== "").length;

          return (
            <div key={mach.id} style={S.machineCard(status)}>
              {/* Card Header */}
              <div style={S.machineCardHead(status)}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                  <span style={{ fontSize: "1.2rem" }}>{mach.icon}</span>
                  <div>
                    <div style={{ fontWeight: "700", fontSize: "0.85rem" }}>{mach.name}</div>
                    <div style={{ fontSize: "0.68rem", opacity: 0.8 }}>
                      প্রয়োজন: {mach.required.qty} টি | Phase: {mach.required.phase} | তথ্য: {filled}/{mach.specs.length}
                    </div>
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <span style={S.summaryTag(status === "pass" ? "✔ PASS" : status === "fail" ? "✘ FAIL" : status === "partial" ? "⚠ আংশিক" : "— তথ্য নেই")}>
                    {status === "pass" ? "✔ PASS" : status === "fail" ? "✘ FAIL" : status === "partial" ? "⚠ আংশিক" : "— তথ্য নেই"}
                  </span>
                  <button onClick={() => setExpanded(prev => ({ ...prev, [mach.id]: !isOpen }))}
                    style={{ background: "rgba(255,255,255,0.2)", border: "none", color: "#fff", padding: "0.2rem 0.55rem", borderRadius: "3px", cursor: "pointer", fontSize: "0.75rem", fontWeight: "700" }}>
                    {isOpen ? "▲ ভাঁজ করুন" : "▼ বিস্তারিত"}
                  </button>
                </div>
              </div>

              {/* Criteria Row */}
              <div style={S.criteriaBox}>
                <span style={{ fontSize: "0.68rem", fontWeight: "700", color: "#555", marginRight: "0.3rem" }}>Criteria:</span>
                {results.map((c, ci) => (
                  <span key={ci} style={S.criteriaTag(c.status === "pass")}>
                    {c.status === "pass" ? "✔" : c.status === "fail" ? "✘" : "○"} {c.label}
                  </span>
                ))}
              </div>

              {/* Spec Fields */}
              {isOpen && (
                <div style={S.specGrid}>
                  {mach.specs.map((spec, si) => {
                    const val = getVal(mach.id, spec.label);
                    const numVal = parseFloat(val);
                    let fieldOk = null;
                    if (spec.minVal !== undefined || spec.maxVal !== undefined) {
                      if (val !== "" && !isNaN(numVal)) {
                        fieldOk = true;
                        if (spec.minVal !== undefined && numVal < spec.minVal) fieldOk = false;
                        if (spec.maxVal !== undefined && numVal > spec.maxVal) fieldOk = false;
                      }
                    }

                    return (
                      <div key={si} style={S.specField}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.18rem" }}>
                          <span style={S.specLabel}>
                            {spec.required && <span style={{ color: "#555", marginRight: "2px" }}>*</span>}
                            {spec.label}
                          </span>
                          <div style={{ display: "flex", gap: "0.3rem", alignItems: "center" }}>
                            {spec.unit && <span style={{ fontSize: "0.6rem", color: "#888" }}>{spec.unit}</span>}
                            {spec.minVal !== undefined && <span style={{ fontSize: "0.58rem", color: "#999" }}>min:{spec.minVal}</span>}
                            {spec.maxVal !== undefined && <span style={{ fontSize: "0.58rem", color: "#999" }}>max:{spec.maxVal}</span>}
                            {fieldOk === true && <span style={{ fontSize: "0.65rem", color: "#333", fontWeight: "700" }}>✔</span>}
                            {fieldOk === false && <span style={{ fontSize: "0.65rem", color: "#888", fontWeight: "700" }}>✘</span>}
                          </div>
                        </div>
                        {spec.type === "select" ? (
                          <select value={val} onChange={e => setVal(mach.id, spec.label, e.target.value)} style={S.specInput(fieldOk)}>
                            <option value="">— নির্বাচন করুন —</option>
                            {spec.options.map((opt, oi) => <option key={oi} value={opt}>{opt}</option>)}
                          </select>
                        ) : (
                          <input
                            type={spec.type}
                            value={val}
                            onChange={e => setVal(mach.id, spec.label, e.target.value)}
                            placeholder={spec.placeholder}
                            style={S.specInput(fieldOk)}
                          />
                        )}
                        {fieldOk === false && (
                          <div style={{ fontSize: "0.62rem", color: "#888", marginTop: "0.15rem" }}>
                            ⚠ স্পেসিফিকেশন পূরণ হয়নি
                            {spec.minVal !== undefined ? ` (সর্বনিম্ন: ${spec.minVal} ${spec.unit || ""})` : ""}
                            {spec.maxVal !== undefined ? ` (সর্বোচ্চ: ${spec.maxVal} ${spec.unit || ""})` : ""}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Notes for this machine */}
              {isOpen && (
                <div style={{ padding: "0 0.9rem 0.9rem" }}>
                  <div style={S.specLabel}>মন্তব্য / পর্যবেক্ষণ ({mach.name})</div>
                  <textarea
                    value={getVal(mach.id, "__notes__")}
                    onChange={e => setVal(mach.id, "__notes__", e.target.value)}
                    placeholder={`${mach.name} সম্পর্কে বিশেষ পর্যবেক্ষণ, ত্রুটি বা সুপারিশ লিখুন...`}
                    style={{ ...S.fieldTextarea, minHeight: "50px" }}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Specification Standards Reference */}
      <div style={S.card}>
        <div style={S.cardTitle}>📋 মেশিন স্পেসিফিকেশন মানদণ্ড রেফারেন্স</div>
        <Tbl
          heads={[
            { label: "মেশিন", left: true },
            { label: "ন্যূনতম ক্ষমতা" },
            { label: "সর্বোচ্চ বয়স" },
            { label: "RHD/LGED স্ট্যান্ডার্ড" },
            { label: "বিশেষ প্রয়োজনীয়তা (পার্বত্য)" },
          ]}
          rows={[
            ["🚜 Excavator", "HP ≥ 130, Bucket ≥ 0.6m³", "≤ 10 বছর", "RHD Equipment Manual 2023", "Crawler Track আবশ্যক"],
            ["🚧 Motor Grader", "HP ≥ 150, Blade ≥ 3.0m", "≤ 12 বছর", "RHD SOR 2023", "Grade Control সুবিধা থাকলে ভালো"],
            ["🛞 Vibratory Roller", "≥ 8 Ton, Freq ≥ 25Hz", "≤ 12 বছর", "AASHTO T-180", "Water Sprinkler আবশ্যক"],
            ["⚙️ Pneumatic Roller", "≥ 10 Ton, ≥ 7 টায়ার", "≤ 15 বছর", "RHD Spec §8.3", "Variable Tyre Pressure উত্তম"],
            ["🏭 Asphalt Plant", "≥ 60 TPH, Silo ≥ 30T", "≤ 15 km সাইট থেকে", "RHD Mix Design Spec", "Bag Filter Dust System আবশ্যক"],
            ["🛤️ Asphalt Paver", "Width ≥ 5.5m", "≤ 12 বছর", "RHD Spec §8.2", "Auto Screed Level Control"],
            ["🚛 Dump Truck", "≥ 8 Ton, ≥ 6 cum", "≤ 12 বছর", "RHD Transport Standard", "Tarpaulin আবশ্যক (Bitumen)"],
            ["🚒 Water Tanker", "≥ 6000L, Pump ≥ 300 LPM", "≤ 15 বছর", "RHD Compaction Spec", "Rear Spray Bar উত্তম"],
            ["🔄 Concrete Mixer", "≥ 0.3m³", "≤ 10 বছর", "PWD Spec §9.1", "Water Measuring System"],
            ["🔩 Plate Compactor", "Force ≥ 10 kN", "≤ 8 বছর", "AASHTO T-99", "সরু Drain সাইডে উপযুক্ত সাইজ"],
            ["⚡ Generator", "≥ 25 KVA, Diesel", "≤ 12 বছর", "Standard Electrical", "AVR সহ হলে ভালো"],
          ]}
        />
        <div style={{ ...S.infoBox, marginTop: "0.7rem" }}>
          📚 রেফারেন্স: RHD Equipment Productivity Manual 2023 | RHD Standard Specification 2017 |
          AASHTO T-99/T-180/T-193 | PWD Specification 2023 | LGED Equipment Standard |
          Bangladesh Standards (BDS) | ISO 9001 Equipment Quality Standard
        </div>
      </div>
    </div>
  );
}

// ─── ASSESSMENT TAB ───
function AssessmentTab({ km }) {
  const [formData, setFormData] = useState({});
  const [specData, setSpecData] = useState({});
  const [photoChecks, setPhotoChecks] = useState({});
  const [measureChecks, setMeasureChecks] = useState({});
  const [activeSection, setActiveSection] = useState("site_general");
  const [activeSubTab, setActiveSubTab] = useState("general"); // general | machine_spec

  const updateField = (secId, label, val) => setFormData(prev => ({ ...prev, [`${secId}_${label}`]: val }));
  const getVal = (secId, label) => formData[`${secId}_${label}`] || "";
  const updateSpec = (key, val) => setSpecData(prev => ({ ...prev, [key]: val }));
  const togglePhoto = (i) => setPhotoChecks(prev => ({ ...prev, [i]: !prev[i] }));
  const toggleMeasure = (i) => setMeasureChecks(prev => ({ ...prev, [i]: !prev[i] }));

  const totalFields = PRE_ASSESSMENT_SECTIONS.reduce((s, sec) => s + sec.items.length, 0);
  const filledFields = Object.values(formData).filter(v => v && v.toString().trim() !== "").length;
  const completionPct = Math.round((filledFields / totalFields) * 100);
  const photoCompPct = Math.round((Object.values(photoChecks).filter(Boolean).length / PHOTO_CHECKLIST.length) * 100);
  const measureCompPct = Math.round((Object.values(measureChecks).filter(Boolean).length / MEASUREMENT_CHECKLIST.length) * 100);

  // Machine spec completion
  const totalSpecFields = MACHINE_SPECS.reduce((s, m) => s + m.specs.length, 0);
  const filledSpecFields = Object.values(specData).filter(v => v && v.toString().trim() !== "" && !String(v).startsWith("__")).length;
  const specCompPct = Math.round((filledSpecFields / totalSpecFields) * 100);
  const machinePassCount = MACHINE_SPECS.filter(m => {
    const results = m.criteria.map(c => {
      const val = parseFloat(specData[`${m.id}_${c.label}`] || specData[`${m.id}_${c.check}`] || "");
      if (isNaN(val)) return "pending";
      if (c.min !== undefined && val < c.min) return "fail";
      if (c.max !== undefined && val > c.max) return "fail";
      return "pass";
    });
    return results.length > 0 && results.every(r => r === "pass");
  }).length;

  const overallPct = Math.round((completionPct + photoCompPct + measureCompPct + specCompPct) / 4);
  const currentSec = PRE_ASSESSMENT_SECTIONS.find(s => s.id === activeSection);

  const subTabs = [
    { id: "general", label: "📋 সাধারণ এসেসমেন্ট" },
    { id: "machine_spec", label: "⚙️ মেশিন স্পেসিফিকেশন চেক" },
    { id: "photo", label: "📷 ফটো ও পরিমাপ" },
    { id: "summary", label: "📊 সারসংক্ষেপ রিপোর্ট" },
  ];

  return (
    <div>
      {/* Overall Progress */}
      <div style={S.card}>
        <div style={S.cardTitle}>প্রি-এসেসমেন্ট সামগ্রিক অগ্রগতি — {km} km সড়ক</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(150px,1fr))", gap: "0.6rem", marginBottom: "0.9rem" }}>
          <StatCard label="সামগ্রিক অগ্রগতি" value={overallPct + "%"} sub="৪টি বিভাগ মিলিয়ে" />
          <StatCard label="সাধারণ ফর্ম" value={completionPct + "%"} sub={filledFields + "/" + totalFields + " পূরণ"} />
          <StatCard label="মেশিন স্পেক চেক" value={specCompPct + "%"} sub={filledSpecFields + "/" + totalSpecFields} />
          <StatCard label="মেশিন PASS" value={machinePassCount + "/" + MACHINE_SPECS.length} sub="সকল Criteria পূরণ" />
          <StatCard label="ফটো চেকলিস্ট" value={photoCompPct + "%"} sub={Object.values(photoChecks).filter(Boolean).length + "/" + PHOTO_CHECKLIST.length} />
          <StatCard label="পরিমাপ চেকলিস্ট" value={measureCompPct + "%"} sub={Object.values(measureChecks).filter(Boolean).length + "/" + MEASUREMENT_CHECKLIST.length} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
          {[
            { label: "সাধারণ এসেসমেন্ট", pct: completionPct },
            { label: "মেশিন স্পেসিফিকেশন", pct: specCompPct },
            { label: "ফটো ডকুমেন্টেশন", pct: photoCompPct },
            { label: "পরিমাপ কার্যক্রম", pct: measureCompPct },
          ].map((b, i) => (
            <div key={i}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.7rem", color: "#555", marginBottom: "0.2rem" }}>
                <span>{b.label}</span><span>{b.pct}%</span>
              </div>
              <div style={S.progressBar()}><div style={S.progressFill(b.pct)} /></div>
            </div>
          ))}
        </div>
      </div>

      {/* Sub-tab Navigation */}
      <div style={{ display: "flex", gap: "0.4rem", marginBottom: "0.9rem", flexWrap: "wrap" }}>
        {subTabs.map(st => (
          <button key={st.id} onClick={() => setActiveSubTab(st.id)} style={{
            padding: "0.45rem 0.9rem", borderRadius: "4px", fontSize: "0.75rem", fontWeight: "600",
            border: "2px solid " + (activeSubTab === st.id ? "#111" : "#ddd"),
            background: activeSubTab === st.id ? "#111" : "#fff",
            color: activeSubTab === st.id ? "#fff" : "#333", cursor: "pointer",
          }}>
            {st.label}
          </button>
        ))}
      </div>

      {/* ── GENERAL ASSESSMENT ── */}
      {activeSubTab === "general" && (
        <>
          {/* Section Navigation */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem", marginBottom: "0.9rem" }}>
            {PRE_ASSESSMENT_SECTIONS.map(sec => {
              const filled = sec.items.filter(item => getVal(sec.id, item.label) !== "").length;
              const pct = Math.round((filled / sec.items.length) * 100);
              return (
                <button key={sec.id} onClick={() => setActiveSection(sec.id)} style={{
                  padding: "0.35rem 0.65rem", borderRadius: "3px", fontSize: "0.7rem", fontWeight: "600",
                  border: "2px solid " + (activeSection === sec.id ? "#111" : "#ddd"),
                  background: activeSection === sec.id ? "#111" : pct === 100 ? "#f0f0f0" : "#fff",
                  color: activeSection === sec.id ? "#fff" : "#333", cursor: "pointer",
                  display: "flex", alignItems: "center", gap: "0.3rem",
                }}>
                  <span>{sec.icon}</span>
                  <span style={{ whiteSpace: "nowrap" }}>{sec.title.substring(0, 18)}</span>
                  <span style={{ fontSize: "0.6rem", background: pct === 100 ? "#555" : "#ddd", color: pct === 100 ? "#fff" : "#666", padding: "0 0.3rem", borderRadius: "2px" }}>{pct}%</span>
                </button>
              );
            })}
          </div>

          {/* Active Section Form */}
          {currentSec && (
            <div style={{ marginBottom: "1rem" }}>
              <div style={S.secHeader(currentSec.color)}>
                <span style={{ fontSize: "1.1rem" }}>{currentSec.icon}</span>
                <span>{currentSec.title}</span>
                <span style={{ marginLeft: "auto", fontSize: "0.72rem", opacity: 0.8 }}>
                  {currentSec.items.filter(item => getVal(currentSec.id, item.label) !== "").length}/{currentSec.items.length} পূরণ
                </span>
              </div>
              <div style={S.secBody}>
                <div style={S.fieldGrid}>
                  {currentSec.items.map((item, idx) => (
                    <div key={idx}>
                      <div style={S.fieldLabel}>{item.label} {getVal(currentSec.id, item.label) ? "✓" : ""}</div>
                      {item.type === "select" ? (
                        <select value={getVal(currentSec.id, item.label)} onChange={e => updateField(currentSec.id, item.label, e.target.value)} style={S.fieldInput}>
                          <option value="">— নির্বাচন করুন —</option>
                          {item.options.map((opt, oi) => <option key={oi} value={opt}>{opt}</option>)}
                        </select>
                      ) : item.type === "textarea" ? (
                        <textarea value={getVal(currentSec.id, item.label)} onChange={e => updateField(currentSec.id, item.label, e.target.value)} placeholder={item.placeholder} style={S.fieldTextarea} />
                      ) : (
                        <input type={item.type} value={getVal(currentSec.id, item.label)} onChange={e => updateField(currentSec.id, item.label, e.target.value)} placeholder={item.placeholder} style={S.fieldInput} />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* All Sections Quick View */}
          <div style={S.card}>
            <div style={S.cardTitle}>সকল বিভাগের অগ্রগতি</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(210px,1fr))", gap: "0.45rem" }}>
              {PRE_ASSESSMENT_SECTIONS.map(sec => {
                const filled = sec.items.filter(item => getVal(sec.id, item.label) !== "").length;
                const pct = Math.round((filled / sec.items.length) * 100);
                return (
                  <div key={sec.id} onClick={() => setActiveSection(sec.id)} style={{ border: "1px solid #e0e0e0", borderRadius: "4px", padding: "0.55rem 0.75rem", cursor: "pointer", background: activeSection === sec.id ? "#f5f5f5" : "#fff" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.25rem" }}>
                      <span style={{ fontSize: "0.73rem", fontWeight: "600" }}>{sec.icon} {sec.title}</span>
                      <span style={{ fontSize: "0.67rem", fontWeight: "700" }}>{pct}%</span>
                    </div>
                    <div style={S.progressBar()}><div style={S.progressFill(pct)} /></div>
                    <div style={{ fontSize: "0.63rem", color: "#888" }}>{filled}/{sec.items.length} পূরণ</div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}

      {/* ── MACHINE SPEC CHECK ── */}
      {activeSubTab === "machine_spec" && (
        <MachineSpecCheck
          specData={specData}
          onChange={updateSpec}
        />
      )}

      {/* ── PHOTO & MEASUREMENT ── */}
      {activeSubTab === "photo" && (
        <>
          <div style={S.card}>
            <div style={S.cardTitle}>📷 ফটো ডকুমেন্টেশন চেকলিস্ট</div>
            <div style={S.progressBar()}><div style={S.progressFill(photoCompPct)} /></div>
            <div style={{ marginBottom: "0.5rem", fontSize: "0.72rem", color: "#555" }}>{Object.values(photoChecks).filter(Boolean).length}/{PHOTO_CHECKLIST.length} সম্পন্ন</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(240px,1fr))", gap: "0.3rem" }}>
              {PHOTO_CHECKLIST.map((item, i) => (
                <div key={i} style={S.checkItem(photoChecks[i])} onClick={() => togglePhoto(i)}>
                  <input type="checkbox" checked={!!photoChecks[i]} onChange={() => togglePhoto(i)} style={S.checkbox} />
                  <span style={{ fontSize: "0.72rem", color: photoChecks[i] ? "#555" : "#333", textDecoration: photoChecks[i] ? "line-through" : "none" }}>{item}</span>
                </div>
              ))}
            </div>
          </div>

          <div style={S.card}>
            <div style={S.cardTitle}>📐 পরিমাপ চেকলিস্ট</div>
            <div style={S.progressBar()}><div style={S.progressFill(measureCompPct)} /></div>
            <div style={{ marginBottom: "0.5rem", fontSize: "0.72rem", color: "#555" }}>{Object.values(measureChecks).filter(Boolean).length}/{MEASUREMENT_CHECKLIST.length} সম্পন্ন</div>
            <div style={{ overflowX: "auto" }}>
              <table style={S.table}>
                <thead>
                  <tr>
                    <th style={{ ...S.th, width: "30px" }}>✓</th>
                    <th style={S.thL}>পরিমাপের বিষয়</th>
                    <th style={S.th}>যন্ত্রপাতি</th>
                    <th style={S.th}>একক</th>
                    <th style={S.th}>ফ্রিকোয়েন্সি</th>
                  </tr>
                </thead>
                <tbody>
                  {MEASUREMENT_CHECKLIST.map((m, i) => (
                    <tr key={i} style={{ background: measureChecks[i] ? "#f5f5f5" : i % 2 === 1 ? "#fafafa" : "#fff", cursor: "pointer" }} onClick={() => toggleMeasure(i)}>
                      <td style={S.td}><input type="checkbox" checked={!!measureChecks[i]} onChange={() => toggleMeasure(i)} style={S.checkbox} /></td>
                      <td style={{ ...S.tdL, textDecoration: measureChecks[i] ? "line-through" : "none", color: measureChecks[i] ? "#888" : "#333" }}>{m.item}</td>
                      <td style={S.td}>{m.tool}</td>
                      <td style={S.td}>{m.unit}</td>
                      <td style={S.td}>{m.freq}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* ── SUMMARY REPORT ── */}
      {activeSubTab === "summary" && (
        <>
          <div style={S.card}>
            <div style={S.cardTitle}>📊 এসেসমেন্ট সারসংক্ষেপ — পূরণকৃত তথ্য</div>
            {PRE_ASSESSMENT_SECTIONS.map(sec => {
              const filledItems = sec.items.filter(item => getVal(sec.id, item.label) !== "");
              if (filledItems.length === 0) return null;
              return (
                <div key={sec.id} style={{ marginBottom: "0.9rem" }}>
                  <div style={{ fontWeight: "700", fontSize: "0.8rem", borderLeft: "4px solid #333", paddingLeft: "0.5rem", marginBottom: "0.4rem" }}>{sec.icon} {sec.title}</div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(240px,1fr))", gap: "0.3rem" }}>
                    {filledItems.map((item, i) => (
                      <div key={i} style={{ background: "#fafafa", border: "1px solid #e8e8e8", borderRadius: "3px", padding: "0.35rem 0.6rem" }}>
                        <div style={{ fontSize: "0.63rem", color: "#888" }}>{item.label}</div>
                        <div style={{ fontSize: "0.73rem", fontWeight: "600", color: "#222" }}>{getVal(sec.id, item.label)}</div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}

            {/* Machine Spec Summary */}
            <div style={{ marginBottom: "0.9rem" }}>
              <div style={{ fontWeight: "700", fontSize: "0.8rem", borderLeft: "4px solid #333", paddingLeft: "0.5rem", marginBottom: "0.4rem" }}>⚙️ মেশিন স্পেসিফিকেশন চেক ফলাফল</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(200px,1fr))", gap: "0.3rem" }}>
                {MACHINE_SPECS.map(m => {
                  const filledCount = m.specs.filter(s => specData[`${m.id}_${s.label}`]).length;
                  const criteriaResults = m.criteria.map(c => {
                    const v = parseFloat(specData[`${m.id}_${c.check}`] || "");
                    if (isNaN(v)) return "pending";
                    if (c.min !== undefined && v < c.min) return "fail";
                    if (c.max !== undefined && v > c.max) return "fail";
                    return "pass";
                  });
                  const allPass = criteriaResults.every(r => r === "pass") && criteriaResults.length > 0;
                  const anyFail = criteriaResults.some(r => r === "fail");
                  const status = filledCount === 0 ? "empty" : allPass ? "pass" : anyFail ? "fail" : "partial";
                  return (
                    <div key={m.id} style={{ background: "#fafafa", border: "1px solid #e8e8e8", borderRadius: "3px", padding: "0.4rem 0.6rem" }}>
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span style={{ fontSize: "0.72rem", fontWeight: "600" }}>{m.icon} {m.name.substring(0, 20)}</span>
                        <span style={S.summaryTag(status === "pass" ? "✔ PASS" : status === "fail" ? "✘ FAIL" : status === "partial" ? "⚠ আংশিক" : "— তথ্য নেই")}>
                          {status === "pass" ? "✔" : status === "fail" ? "✘" : status === "partial" ? "⚠" : "—"}
                        </span>
                      </div>
                      <div style={{ fontSize: "0.63rem", color: "#888", marginTop: "0.1rem" }}>{filledCount}/{m.specs.length} তথ্য পূরণ</div>
                    </div>
                  );
                })}
              </div>
            </div>

            {filledFields === 0 && Object.keys(specData).length === 0 && (
              <div style={{ ...S.infoBox, textAlign: "center", padding: "1.5rem" }}>
                📝 এখনো কোনো তথ্য পূরণ করা হয়নি। উপরের বিভাগগুলোতে তথ্য পূরণ শুরু করুন।
              </div>
            )}
          </div>

          <div style={{ ...S.infoBox }}>
            <b>✅ প্রি-এসেসমেন্ট রিপোর্ট জমার আগে নিশ্চিত করুন:</b><br />
            ✔ সকল বিভাগের ফর্ম পূরণ সম্পন্ন | ✔ মেশিন স্পেসিফিকেশন চেক সম্পন্ন ও PASS হয়েছে |
            ✔ GPS Coordinate নেওয়া হয়েছে | ✔ Soil Sample পাঠানো হয়েছে |
            ✔ ফটো ডকুমেন্টেশন সম্পন্ন | ✔ Contractor-কে Risk জানানো হয়েছে
          </div>
        </>
      )}
    </div>
  );
}

// ─── QUANTITY & MACHINE CALCULATIONS ───
function calcQuantities(len) {
  const w = 5.5; const s = len / 1000;
  return {
    boxCutting: round2(len * w * 0.60 * CF.soil), isg: round2(len * w * 0.20 * CF.soil),
    subBase: round2(len * w * 0.20 * CF.subBase), aggBase: round2(len * w * 0.20 * CF.aggregateBase),
    wearingCourse: round2(len * w * 0.05 * CF.bitumin), primeCoat: round2(len * w),
    brickEdging: round2(len * 2), hbbExc: round2(len * 2 * 1.2 * 0.35 * CF.soil),
    hbbIsg: round2(len * 2 * 1.2 * 0.15 * CF.soil), hbbSoling: round2(len * 2 * 1.2),
    hbbHerring: round2(len * 2 * 1.2), hbbEdge: round2(len * 2),
    uExc: round2(1950 * s), uSand: round2(101.25 * s), uSoling: round2(1350 * s),
    uCC: round2(168.75 * s), uWall: round2(501 * s), uPlaster: round2(2870 * s), uBackfill: round2(125.25 * s),
    lExc: round2(1620 * s), lSand: round2(95.63 * s), lSoling: round2(1275 * s),
    lCC: round2(159.38 * s), lWall: round2(300 * s), lPlaster: round2(2280 * s), lBackfill: round2(195 * s),
    wcMT: round2(round2(len * w * 0.05 * CF.bitumin) * 2.35),
    subBaseArea: round2(len * w), aggBaseArea: round2(len * w), isgArea: round2(len * w),
  };
}

function calcMachineNeeds(Q) {
  const WD = 8;
  const totalExcCum = Q.boxCutting + Q.hbbExc + Q.uExc + Q.lExc + Q.uBackfill + Q.lBackfill;
  const excProd = PROD.excavator * EFF.excavator * WD;
  const excNeeded = Math.ceil(totalExcCum / (excProd * 9));
  const totalGrade = Q.isgArea + Q.subBaseArea + Q.aggBaseArea;
  const graderProd = PROD.grader * EFF.grader * WD;
  const graderNeeded = Math.ceil(totalGrade / (graderProd * 12));
  const rollerArea = Q.isgArea + Q.subBaseArea + Q.aggBaseArea + Q.hbbSoling + Q.hbbHerring;
  const rollerProd = PROD.vibRoller * EFF.roller * WD;
  const rollerNeeded = Math.ceil(rollerArea / (rollerProd * 15));
  const totalCC = Q.uCC + Q.lCC;
  const mixerProd = PROD.concMixer * EFF.mixer * WD;
  const mixerNeeded = Math.ceil(totalCC / (mixerProd * 20));
  const totalHaul = Q.boxCutting + Q.hbbExc + Q.uExc + Q.lExc + Q.subBase + Q.aggBase;
  const truckTrips = Math.ceil(totalHaul / PROD.dumpTruck);
  const truckCycle = Math.floor(EFF.truck * WD * 60 / 45);
  const truckNeeded = Math.ceil(truckTrips / (truckCycle * 21));
  const waterLiter = (Q.isgArea + Q.subBaseArea + Q.aggBaseArea) * 8;
  const tankerProd = PROD.waterTanker * EFF.tanker * WD;
  const tankerNeeded = Math.ceil(waterLiter / (tankerProd * 12));
  const compArea = (Q.uSoling + Q.lSoling + Q.hbbSoling) * 0.5;
  const compProd = PROD.plateCompactor * EFF.compactor * WD;
  const compNeeded = Math.ceil(compArea / (compProd * 18));
  const plantProd = PROD.asphaltPlant * EFF.plant * WD;
  const plantDays = Math.ceil(Q.wcMT / plantProd);
  const paverProd = PROD.paver * EFF.paver * WD;
  const paverDays = Math.ceil(Q.primeCoat / paverProd);

  return [
    { name: "Excavator (PC-200)", phase: "Earthwork", totalWork: totalExcCum, unit: "cum", prodRaw: PROD.excavator, eff: EFF.excavator, prodPerDay: round2(excProd), needed: excNeeded, actualDays: Math.ceil(totalExcCum / (excProd * excNeeded)), arrive: 1, depart: Math.min(Math.ceil(totalExcCum / (excProd * excNeeded)) + 1, 15), hpd: 8, rate: RATES.excavatorHour, mob: 35000 },
    { name: "Motor Grader", phase: "Base", totalWork: totalGrade, unit: "sqm", prodRaw: PROD.grader, eff: EFF.grader, prodPerDay: round2(graderProd), needed: graderNeeded, actualDays: Math.ceil(totalGrade / (graderProd * graderNeeded)), arrive: 7, depart: Math.min(7 + Math.ceil(totalGrade / (graderProd * graderNeeded)), 22), hpd: 8, rate: RATES.motorGraderHour, mob: 28000 },
    { name: "Vibratory Roller (10T)", phase: "Base", totalWork: rollerArea, unit: "sqm", prodRaw: PROD.vibRoller, eff: EFF.roller, prodPerDay: round2(rollerProd), needed: rollerNeeded, actualDays: Math.ceil(rollerArea / (rollerProd * rollerNeeded)), arrive: 7, depart: Math.min(7 + Math.ceil(rollerArea / (rollerProd * rollerNeeded)), 23), hpd: 8, rate: RATES.rollerHour, mob: 22000 },
    { name: "Pneumatic Roller", phase: "Surface", totalWork: Q.primeCoat, unit: "sqm", prodRaw: PROD.pneumaticRoller, eff: EFF.roller, prodPerDay: round2(PROD.pneumaticRoller * EFF.roller * WD), needed: 1, actualDays: Math.ceil(Q.primeCoat / (PROD.pneumaticRoller * EFF.roller * WD)), arrive: 21, depart: 28, hpd: 8, rate: RATES.rollerHour, mob: 22000 },
    { name: "Asphalt Plant (60TPH)", phase: "Surface", totalWork: Q.wcMT, unit: "MT", prodRaw: PROD.asphaltPlant, eff: EFF.plant, prodPerDay: round2(PROD.asphaltPlant * EFF.plant * WD), needed: 1, actualDays: plantDays, arrive: 20, depart: Math.min(20 + plantDays, 28), hpd: 8, rate: RATES.asphaltPlantHour, mob: 120000 },
    { name: "Asphalt Paver", phase: "Surface", totalWork: Q.primeCoat, unit: "sqm", prodRaw: PROD.paver, eff: EFF.paver, prodPerDay: round2(paverProd), needed: 1, actualDays: paverDays, arrive: 21, depart: Math.min(21 + paverDays, 28), hpd: 8, rate: RATES.paverHour, mob: 45000 },
    { name: "Dump Truck (10T)", phase: "Earthwork/Base", totalWork: truckTrips, unit: "trip", prodRaw: truckCycle, eff: EFF.truck, prodPerDay: round2(truckCycle * EFF.truck), needed: truckNeeded, actualDays: 24, arrive: 1, depart: 25, hpd: 8, rate: RATES.dumpTruckHour, mob: 8000 },
    { name: "Water Tanker (8000L)", phase: "Base", totalWork: Math.round(waterLiter), unit: "liter", prodRaw: PROD.waterTanker, eff: EFF.tanker, prodPerDay: round2(PROD.waterTanker * EFF.tanker * 6), needed: tankerNeeded, actualDays: 12, arrive: 7, depart: 22, hpd: 6, rate: RATES.waterTankerHour, mob: 10000 },
    { name: "Concrete Mixer", phase: "Drain", totalWork: totalCC, unit: "cum", prodRaw: PROD.concMixer, eff: EFF.mixer, prodPerDay: round2(mixerProd), needed: mixerNeeded, actualDays: Math.ceil(totalCC / (mixerProd * mixerNeeded)), arrive: 10, depart: Math.min(10 + Math.ceil(totalCC / (mixerProd * mixerNeeded)), 25), hpd: 8, rate: RATES.concreteLabHour, mob: 5000 },
    { name: "Plate Compactor", phase: "Drain/HBB", totalWork: round2(compArea), unit: "sqm", prodRaw: PROD.plateCompactor, eff: EFF.compactor, prodPerDay: round2(compProd), needed: compNeeded, actualDays: 18, arrive: 4, depart: 23, hpd: 8, rate: 1500, mob: 3000 },
    { name: "Generator (25KVA)", phase: "General", totalWork: 30, unit: "দিন", prodRaw: 1, eff: 1, prodPerDay: 1, needed: 1, actualDays: 30, arrive: 1, depart: 30, hpd: 8, rate: 800, mob: 4000 },
  ].map(m => { const days = m.depart - m.arrive + 1; const workCost = m.needed * m.hpd * days * m.rate; const mobCost = m.mob * m.needed * 2; return { ...m, days, workCost, mobCost, total: workCost + mobCost }; });
}

function calcLaborNeeds(Q, km, machines) {
  const excQty = machines.find(m => m.name.includes("Excavator"))?.needed || 2;
  const truckQty = machines.find(m => m.name.includes("Dump"))?.needed || 4;
  const earthworkCum = Q.boxCutting + Q.hbbExc + Q.uExc + Q.lExc;
  const earthManualCum = round2(earthworkCum * 0.30);
  const earthLaborNeeded = Math.ceil(earthManualCum / (3.5 * 9));
  const masonryVol = Q.uWall + Q.lWall;
  const masonNeeded = Math.ceil(masonryVol / (1.8 * 20));
  const solingArea = Q.uSoling + Q.lSoling + Q.hbbSoling + Q.hbbHerring;
  const solingLaborNeeded = Math.ceil(solingArea / (3.5 * 13));
  const totalPlaster = Q.uPlaster + Q.lPlaster;
  const plasterMasonNeeded = Math.ceil(totalPlaster / (12 * 20));
  const totalCC = Q.uCC + Q.lCC;
  const ccLabor = Math.ceil(totalCC / (0.8 * 20));
  const baseLabor = Math.ceil((machines.find(m => m.name.includes("Grader"))?.needed || 1) * 3 + (machines.find(m => m.name.includes("Vibratory"))?.needed || 2) * 2);
  const supervisors = Math.ceil((earthLaborNeeded + masonNeeded + plasterMasonNeeded + ccLabor + baseLabor + solingLaborNeeded) / 15);
  return [
    { role: "সুপারভাইজার/ফোরম্যান", skill: "দক্ষ", phase: "সকল", count: supervisors, rate: RATES.laborSkilled, days: 30 },
    { role: "মাটি কাটা সহকারী", skill: "অদক্ষ", phase: "D1-D9", count: earthLaborNeeded + 5, rate: RATES.laborUnskilled, days: 9 },
    { role: "বেস লেয়ার সহকারী", skill: "অর্ধদক্ষ", phase: "D9-D20", count: baseLabor, rate: RATES.laborSemiSkilled, days: 12 },
    { role: "রাজমিস্ত্রি (Brick Wall)", skill: "দক্ষ", phase: "D10-D25", count: masonNeeded + 2, rate: RATES.laborSkilled, days: 16 },
    { role: "রাজমিস্ত্রি সহকারী", skill: "অদক্ষ", phase: "D10-D25", count: masonNeeded + 2, rate: RATES.laborUnskilled, days: 16 },
    { role: "সোলিং মিস্ত্রি", skill: "দক্ষ", phase: "D10-D23", count: solingLaborNeeded + 3, rate: RATES.laborSkilled, days: 14 },
    { role: "সোলিং সহকারী", skill: "অদক্ষ", phase: "D10-D23", count: Math.ceil((solingLaborNeeded + 3) * 0.8), rate: RATES.laborUnskilled, days: 14 },
    { role: "কংক্রিট শ্রমিক", skill: "অর্ধদক্ষ", phase: "D10-D25", count: ccLabor + 3, rate: RATES.laborSemiSkilled, days: 16 },
    { role: "প্লাস্টার মিস্ত্রি", skill: "দক্ষ", phase: "D18-D26", count: plasterMasonNeeded + 2, rate: RATES.laborSkilled, days: 9 },
    { role: "বিটুমিনাস শ্রমিক", skill: "দক্ষ", phase: "D20-D28", count: 12, rate: RATES.laborSkilled, days: 9 },
    { role: "ড্রাইভার/অপারেটর", skill: "দক্ষ", phase: "D1-D28", count: excQty + truckQty + 4, rate: RATES.laborSkilled, days: 25 },
    { role: "লোডিং শ্রমিক", skill: "অদক্ষ", phase: "D1-D25", count: Math.ceil(truckQty * 1.5), rate: RATES.laborUnskilled, days: 20 },
    { role: "নিরাপত্তা শ্রমিক", skill: "অদক্ষ", phase: "D1-D30", count: 4, rate: RATES.laborUnskilled, days: 30 },
  ].map(l => ({ ...l, total: l.count * l.rate * l.days }));
}

// ─── MAIN TABS ───
// ─── MATERIAL SUMMARY MODULE ───
// Layer 3 (Material Summary) — pure aggregation. Reads coefficients ONLY via the
// resolveMaterialProperty/resolveMixProfile resolvers, never hardcodes a number itself.
// Session edits to Material Master (propOverrides/mixOverrides below) act as an in-memory
// stand-in for the future Project Override layer — same resolver, same precedence.
function MaterialSummaryTab({ items, km }) {
  const [expanded, setExpanded] = useState({});
  const [showMaster, setShowMaster] = useState(false);
  const [propOverrides, setPropOverrides] = useState({}); // { [material]: {field: value} }
  const [mixOverrides, setMixOverrides] = useState({});   // { [profileName]: { materials: [{material, coeff}] } }
  const [transportCfg, setTransportCfg] = useState({});   // { [rowKey]: {tripsPerTruckPerDay, workingDays} }

  const setProp = (material, field, value) => {
    setPropOverrides(prev => ({ ...prev, [material]: { ...prev[material], [field]: value === "" ? "" : Number(value) } }));
  };
  const setMixCoeff = (profileName, material, value) => {
    setMixOverrides(prev => {
      const existing = prev[profileName]?.materials || [];
      const others = existing.filter(m => m.material !== material);
      return { ...prev, [profileName]: { materials: [...others, { material, coeff: value === "" ? "" : Number(value) }] } };
    });
  };
  const setTransport = (rowKey, field, value) => {
    setTransportCfg(prev => ({ ...prev, [rowKey]: { ...prev[rowKey], [field]: value === "" ? "" : Number(value) } }));
  };

  // ── Layer 2→3: expand every BOQ item into its constituent materials via Material Breakdown Rules + Material Master ──
  const contributions = [];
  const profilesUsed = new Set();
  items.forEach(item => {
    const profileName = BOQ_MATERIAL_PROFILE_MAP[item.key];
    if (!profileName) return;
    profilesUsed.add(profileName);
    const profile = resolveMixProfile(profileName, mixOverrides);
    if (!profile) return;
    profile.materials.forEach(m => {
      const coeff = Number(m.coeff) || 0;
      const props = resolveMaterialProperty(m.material, propOverrides);
      contributions.push({
        material: m.material,
        unit: props.unit || "-",
        boqItem: item.name,
        section: item.section,
        profileName,
        coeff,
        boqQty: item.qty,
        matQty: round2(item.qty * coeff),
      });
    });
  });

  // ── Group by (material, unit) — never merge mismatched units ──
  const rowsMap = {};
  contributions.forEach(c => {
    const key = `${c.material}|${c.unit}`;
    if (!rowsMap[key]) rowsMap[key] = { material: c.material, unit: c.unit, totalQty: 0, contributions: [] };
    rowsMap[key].totalQty = round2(rowsMap[key].totalQty + c.matQty);
    rowsMap[key].contributions.push(c);
  });
  const rows = Object.values(rowsMap).sort((a, b) => b.totalQty - a.totalQty);

  // ── Dashboard aggregates ──
  const totalMaterials = rows.length;
  const largest = rows[0];
  const totalVolumeCum = round2(rows.filter(r => r.unit === "Cum").reduce((s, r) => s + r.totalQty, 0));

  const rowTransport = (row) => {
    const props = resolveMaterialProperty(row.material, propOverrides);
    const cfg = transportCfg[`${row.material}|${row.unit}`] || {};
    const truckCapacity = props.truckCapacity;
    const loose = props.looseFactor || 1;
    const bulking = props.bulkingFactor || 1;
    const compaction = props.compactionFactor || 1;
    const tripsPerTruckPerDay = cfg.tripsPerTruckPerDay ?? 2;
    const workingDays = cfg.workingDays ?? Math.max(1, Math.ceil(km * 4));
    const looseQty = round2(row.totalQty * bulking * loose / compaction);
    const requiredTrips = truckCapacity ? Math.ceil(looseQty / truckCapacity) : null;
    const requiredTrucks = requiredTrips ? Math.ceil(requiredTrips / (tripsPerTruckPerDay * workingDays)) : null;
    const dailySupply = requiredTrips ? round2(looseQty / workingDays) : null;
    return { truckCapacity, loose, bulking, compaction, tripsPerTruckPerDay, workingDays, looseQty, requiredTrips, requiredTrucks, dailySupply };
  };

  const totalTrips = rows.reduce((s, r) => s + (rowTransport(r).requiredTrips || 0), 0);
  const totalTrucks = rows.reduce((s, r) => s + (rowTransport(r).requiredTrucks || 0), 0);

  const materialsInvolved = Array.from(new Set(rows.map(r => r.material)));
  const inputCell = (val, onChange, w) => (
    <input type="number" value={val === null || val === undefined ? "" : val} placeholder={val === null ? "N/A" : ""} disabled={val === null}
      onChange={e => onChange(e.target.value)}
      style={{ width: w || "60px", border: "1px solid #ccc", borderRadius: "3px", padding: "0.2rem 0.3rem", fontSize: "0.68rem", textAlign: "center", background: val === null ? "#f0f0f0" : "#fff" }} />
  );

  return (
    <div>
      <div style={S.statGrid}>
        <StatCard label="মোট ম্যাটেরিয়াল" value={totalMaterials} sub={materialsInvolved.length + " প্রকার"} />
        <StatCard label="সর্বোচ্চ ম্যাটেরিয়াল" value={largest ? largest.material : "-"} sub={largest ? fmtQ(largest.totalQty) + " " + largest.unit : ""} />
        <StatCard label="মোট আয়তন (Cum)" value={fmtQ(totalVolumeCum)} sub="একই এককের ম্যাটেরিয়াল যোগফল" />
        <StatCard label="মোট ট্রাক ট্রিপ" value={fmt(totalTrips)} sub="সকল ম্যাটেরিয়াল" />
        <StatCard label="প্রয়োজনীয় ট্রাক" value={fmt(totalTrucks)} sub="সকল ম্যাটেরিয়াল" />
      </div>

      <div style={S.card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: showMaster ? "0.7rem" : 0 }}>
          <div style={S.cardTitle}>📚 Material Master (RHD Standard 2023) — এডিটেবল</div>
          <button onClick={() => setShowMaster(s => !s)} style={{ background: "#111", color: "#fff", border: "none", padding: "0.3rem 0.7rem", borderRadius: "3px", fontSize: "0.7rem", fontWeight: "700", cursor: "pointer" }}>
            {showMaster ? "▲ লুকান" : "▼ দেখুন / সম্পাদনা করুন"}
          </button>
        </div>
        {showMaster && (
          <>
            <div style={{ fontSize: "0.68rem", fontWeight: "700", color: "#555", margin: "0.5rem 0" }}>Material Properties</div>
            <div style={{ overflowX: "auto" }}>
              <table style={S.table}>
                <thead><tr>
                  <th style={S.thL}>Material</th><th style={S.th}>Profile</th><th style={S.th}>Unit</th><th style={S.th}>Density</th>
                  <th style={S.th}>Loose Factor</th><th style={S.th}>Bulking Factor</th><th style={S.th}>Compaction Factor</th>
                  <th style={S.th}>Wastage %</th><th style={S.th}>Truck Capacity</th>
                </tr></thead>
                <tbody>
                  {materialsInvolved.map((mat, i) => {
                    const p = resolveMaterialProperty(mat, propOverrides);
                    return (
                      <tr key={mat} style={i % 2 === 1 ? { background: "#fafafa" } : {}}>
                        <td style={S.tdL}><b>{mat}</b></td>
                        <td style={S.td}>{p.profile}</td>
                        <td style={S.td}>{p.unit}</td>
                        <td style={S.td}>{inputCell(p.density, v => setProp(mat, "density", v))}</td>
                        <td style={S.td}>{inputCell(p.looseFactor, v => setProp(mat, "looseFactor", v))}</td>
                        <td style={S.td}>{inputCell(p.bulkingFactor, v => setProp(mat, "bulkingFactor", v))}</td>
                        <td style={S.td}>{inputCell(p.compactionFactor, v => setProp(mat, "compactionFactor", v))}</td>
                        <td style={S.td}>{inputCell(p.wastagePct, v => setProp(mat, "wastagePct", v))}</td>
                        <td style={S.td}>{inputCell(p.truckCapacity, v => setProp(mat, "truckCapacity", v))}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div style={{ fontSize: "0.68rem", fontWeight: "700", color: "#555", margin: "0.9rem 0 0.5rem" }}>Mix / Consumption Profiles</div>
            <div style={{ overflowX: "auto" }}>
              <table style={S.table}>
                <thead><tr><th style={S.thL}>Profile</th><th style={S.thL}>Constituent Materials (coefficient per 1 unit of BOQ item)</th></tr></thead>
                <tbody>
                  {Array.from(profilesUsed).map((pn, i) => {
                    const prof = resolveMixProfile(pn, mixOverrides);
                    return (
                      <tr key={pn} style={i % 2 === 1 ? { background: "#fafafa" } : {}}>
                        <td style={S.tdL}><b>{pn}</b></td>
                        <td style={S.tdL}>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.6rem" }}>
                            {prof.materials.map(m => (
                              <div key={m.material} style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}>
                                <span style={{ fontSize: "0.68rem", color: "#444" }}>{m.material}:</span>
                                {inputCell(m.coeff, v => setMixCoeff(pn, m.material, v), "70px")}
                              </div>
                            ))}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div style={{ ...S.infoBox, marginTop: "0.6rem" }}>
              ℹ️ এই মানগুলো এই সেশনের জন্য BOQ-এর যেকোনো পরিবর্তনে স্বয়ংক্রিয়ভাবে পুনরায় প্রয়োগ হবে। ভবিষ্যতে Organization Profile (RHD/LGED/BWDB/PWD/Army/Private) ও Version অনুযায়ী পৃথক Master ডেটা ব্যবহারের জন্য এই কাঠামো প্রস্তুত।
            </div>
          </>
        )}
      </div>

      <div style={S.card}>
        <div style={S.cardTitle}>Material Summary — {km} km (BOQ থেকে স্বয়ংক্রিয়ভাবে গণনাকৃত)</div>
        <div style={{ overflowX: "auto" }}>
          <table style={S.table}>
            <thead><tr>
              <th style={S.thL}>Material</th><th style={S.th}>Unit</th><th style={S.th}>Total Quantity</th>
              <th style={S.th}>BOQ Items</th><th style={S.th}>Expand</th><th style={S.thL}>Remarks</th>
            </tr></thead>
            <tbody>
              {rows.map((row, i) => {
                const key = `${row.material}|${row.unit}`;
                const isOpen = !!expanded[key];
                const props = resolveMaterialProperty(row.material, propOverrides);
                const t = rowTransport(row);
                return (
                  <React.Fragment key={key}>
                    <tr style={i % 2 === 1 ? { background: "#fafafa" } : {}}>
                      <td style={S.tdL}><b>{row.material}</b></td>
                      <td style={S.td}>{row.unit}</td>
                      <td style={S.tdB}>{fmtQ(row.totalQty)}</td>
                      <td style={S.td}>{row.contributions.length}</td>
                      <td style={S.td}>
                        <button onClick={() => setExpanded(p => ({ ...p, [key]: !isOpen }))}
                          style={{ background: "#111", color: "#fff", border: "none", padding: "0.15rem 0.5rem", borderRadius: "3px", fontSize: "0.65rem", fontWeight: "700", cursor: "pointer" }}>
                          {isOpen ? "▲" : "▼"}
                        </button>
                      </td>
                      <td style={S.tdL}>{props.remarks || (props.wastagePct ? `Wastage ${props.wastagePct}%` : "")}</td>
                    </tr>
                    {isOpen && (
                      <tr>
                        <td colSpan={6} style={{ padding: 0, borderBottom: "1px solid #ebebeb" }}>
                          <div style={{ background: "#fafafa", padding: "0.7rem 1rem" }}>
                            <Tbl
                              heads={[{ label: "BOQ Item", left: true }, { label: "Profile / Formula" }, { label: "BOQ Qty" }, { label: "Coefficient" }, { label: "Material Qty" }, { label: "Contribution" }]}
                              rows={row.contributions.map(c => [
                                c.boqItem, c.profileName, fmtQ(c.boqQty), c.coeff,
                                { val: fmtQ(c.matQty) + " " + row.unit, bold: true },
                                (round2((c.matQty / row.totalQty) * 100)) + "%",
                              ])}
                              totalRow={["Grand Total", "", "", "", fmtQ(row.totalQty) + " " + row.unit, "100%"]}
                            />
                            <div style={{ marginTop: "0.7rem" }}>
                              <div style={{ fontSize: "0.7rem", fontWeight: "700", color: "#555", marginBottom: "0.35rem" }}>🚛 Transport Calculator — {row.material}</div>
                              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(140px,1fr))", gap: "0.5rem", marginBottom: "0.5rem" }}>
                                <div><div style={S.specLabel}>Truck Capacity ({row.unit})</div>{inputCell(props.truckCapacity, v => setProp(row.material, "truckCapacity", v), "100%")}</div>
                                <div><div style={S.specLabel}>Loose Factor</div>{inputCell(props.looseFactor, v => setProp(row.material, "looseFactor", v), "100%")}</div>
                                <div><div style={S.specLabel}>Bulking Factor</div>{inputCell(props.bulkingFactor, v => setProp(row.material, "bulkingFactor", v), "100%")}</div>
                                <div><div style={S.specLabel}>Compaction Factor</div>{inputCell(props.compactionFactor, v => setProp(row.material, "compactionFactor", v), "100%")}</div>
                                <div><div style={S.specLabel}>Trips/Truck/Day</div>{inputCell(t.tripsPerTruckPerDay, v => setTransport(key, "tripsPerTruckPerDay", v), "100%")}</div>
                                <div><div style={S.specLabel}>Working Days</div>{inputCell(t.workingDays, v => setTransport(key, "workingDays", v), "100%")}</div>
                              </div>
                              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(140px,1fr))", gap: "0.5rem" }}>
                                <StatCard label="Loose Quantity" value={fmtQ(t.looseQty) + " " + row.unit} />
                                <StatCard label="Required Trips" value={t.requiredTrips !== null ? fmt(t.requiredTrips) : "N/A"} />
                                <StatCard label="Required Trucks" value={t.requiredTrucks !== null ? fmt(t.requiredTrucks) : "N/A"} />
                                <StatCard label="Daily Supply" value={t.dailySupply !== null ? fmtQ(t.dailySupply) + " " + row.unit : "N/A"} />
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div style={S.infoBox}>
        📐 Architecture: BOQ → Material Breakdown Rules → Material Master → Material Summary. কোনো কোয়ান্টিটি এখানে পুনরায় গণনা করা হয়নি — সবকিছু বিদ্যমান BOQ থেকে সরাসরি নেওয়া। নতুন ম্যাটেরিয়াল বা প্রোফাইল যোগ করতে শুধু MATERIAL_PROPERTIES / MIX_PROFILES / BOQ_MATERIAL_PROFILE_MAP-এ এন্ট্রি যোগ করুন।
      </div>
    </div>
  );
}

const TABS = [
  { id: "preassess", label: "প্রি-এসেসমেন্ট" },
  { id: "overview", label: "সারসংক্ষেপ" },
  { id: "boq", label: "BOQ" },
  { id: "materials", label: "ম্যাটেরিয়াল সামারি" },
  { id: "labor", label: "লোকবল" },
  { id: "machinery", label: "মেশিনারিজ" },
  { id: "transport", label: "পরিবহন" },
  { id: "verify", label: "যাচাই" },
  { id: "histogram", label: "হিস্টোগ্রাম" },
  { id: "gantt", label: "গ্যান্ট চার্ট" },
  { id: "rates", label: "বাজারমূল্য" },
];

export default function App() {
  const [tab, setTab] = useState("preassess");
  const [km, setKm] = useState(1);
  const len = km * 1000;

  const Q = calcQuantities(len);
  const machines = calcMachineNeeds(Q);
  const laborList = calcLaborNeeds(Q, km, machines);

  const mkItems = (arr) => arr.map(i => ({ ...i, amount: Math.round(i.qty * i.rate) }));
  const flexItems = mkItems([
    { name: "Box Cutting", qty: Q.boxCutting, rate: RATES.boxCutting, key: "boxCutting" },
    { name: "ISG", qty: Q.isg, rate: RATES.improveSubGrade, key: "isg" },
    { name: "Sub-Base", qty: Q.subBase, rate: RATES.subBase, key: "subBase" },
    { name: "Aggregate Base", qty: Q.aggBase, rate: RATES.aggregateBase, key: "aggBase" },
    { name: "Wearing Course", qty: Q.wearingCourse, rate: RATES.wearingCourse, key: "wearingCourse" },
    { name: "Prime Coat", qty: Q.primeCoat, rate: RATES.bituminousPrimeCoat, key: "primeCoat" },
    { name: "Brick Edging", qty: Q.brickEdging, rate: RATES.brickOnEnd, key: "brickEdging" },
  ]);
  const hbbItems = mkItems([
    { name: "HBB Excavation", qty: Q.hbbExc, rate: RATES.roadwayExcavation, key: "hbbExc" },
    { name: "HBB ISG", qty: Q.hbbIsg, rate: RATES.improveSubGrade, key: "hbbIsg" },
    { name: "HBB Edging", qty: Q.hbbEdge, rate: RATES.brickOnEnd, key: "hbbEdge" },
    { name: "HBB Flat Soling", qty: Q.hbbSoling, rate: RATES.brickFlatSoling, key: "hbbSoling" },
    { name: "Herring Bond", qty: Q.hbbHerring, rate: RATES.herringBondBrick, key: "hbbHerring" },
  ]);
  const udrItems = mkItems([
    { name: "U-Drain Exc", qty: Q.uExc, rate: RATES.roadwayExcavation, key: "uExc" },
    { name: "U-Drain Sand", qty: Q.uSand, rate: RATES.sandFilling, key: "uSand" },
    { name: "U-Drain Soling", qty: Q.uSoling, rate: RATES.brickFlatSoling, key: "uSoling" },
    { name: "U-Drain CC", qty: Q.uCC, rate: RATES.cc3inch, key: "uCC" },
    { name: "U-Drain Wall", qty: Q.uWall, rate: RATES.brickwall10inch, key: "uWall" },
    { name: "U-Drain Plaster", qty: Q.uPlaster, rate: RATES.plaster12inch, key: "uPlaster" },
    { name: "U-Drain Backfill", qty: Q.uBackfill, rate: RATES.excavationBackfill, key: "uBackfill" },
  ]);
  const ldrItems = mkItems([
    { name: "L-Drain Exc", qty: Q.lExc, rate: RATES.roadwayExcavation, key: "lExc" },
    { name: "L-Drain Sand", qty: Q.lSand, rate: RATES.sandFilling, key: "lSand" },
    { name: "L-Drain Soling", qty: Q.lSoling, rate: RATES.brickFlatSoling, key: "lSoling" },
    { name: "L-Drain CC", qty: Q.lCC, rate: RATES.cc3inch, key: "lCC" },
    { name: "L-Drain Wall", qty: Q.lWall, rate: RATES.brickwall10inch, key: "lWall" },
    { name: "L-Drain Plaster", qty: Q.lPlaster, rate: RATES.plaster12inch, key: "lPlaster" },
    { name: "L-Drain Backfill", qty: Q.lBackfill, rate: RATES.excavationBackfill, key: "lBackfill" },
  ]);

  const flexT = flexItems.reduce((s, i) => s + i.amount, 0);
  const hbbT = hbbItems.reduce((s, i) => s + i.amount, 0);
  const udrT = udrItems.reduce((s, i) => s + i.amount, 0);
  const ldrT = ldrItems.reduce((s, i) => s + i.amount, 0);
  const laborT = laborList.reduce((s, i) => s + i.total, 0);
  const machineryWorkT = machines.reduce((s, i) => s + i.workCost, 0);
  const machineryMobT = machines.reduce((s, i) => s + i.mobCost, 0);
  const machineryT = machines.reduce((s, i) => s + i.total, 0);
  // Combined BOQ item list — feeds the Material Breakdown layer. Reuses the already-computed
  // qty/amount from the arrays above; does not recompute anything.
  const allBoqItems = [
    ...flexItems.map(i => ({ ...i, section: "ফ্লেক্সিবল পেভমেন্ট" })),
    ...hbbItems.map(i => ({ ...i, section: "HBB Hard Shoulder" })),
    ...udrItems.map(i => ({ ...i, section: "U-Type Drain" })),
    ...ldrItems.map(i => ({ ...i, section: "L-Type Drain" })),
  ];
  const matTransTotal = Math.round(km * 850000);
  const contingency = Math.round((flexT + hbbT + udrT + ldrT + laborT + machineryT + matTransTotal) * 0.05);
  const grandTotal = flexT + hbbT + udrT + ldrT + laborT + machineryT + matTransTotal + contingency;
  const savings = machines.reduce((s, m) => s + (30 - m.days) * m.hpd * m.rate * m.needed, 0);
  const totalLaborCount = laborList.reduce((s, i) => s + i.count, 0);

  const ganttTasks = [
    { task: "Mobilization & Setup", start: 1, dur: 2, phase: "Prep" },
    { task: "Box Cutting", start: 2, dur: 7, phase: "Earthwork" },
    { task: "Drain Excavation", start: 3, dur: 9, phase: "Drain" },
    { task: "ISG Layer", start: 8, dur: 4, phase: "Base" },
    { task: "Sub-Base Layer", start: 10, dur: 4, phase: "Base" },
    { task: "Sand Filling & Soling", start: 9, dur: 5, phase: "Drain" },
    { task: "Aggregate Base Type-1", start: 13, dur: 5, phase: "Base" },
    { task: "HBB Hard Shoulder", start: 11, dur: 11, phase: "HBB" },
    { task: "Drain Wall + CC", start: 12, dur: 8, phase: "Drain" },
    { task: "Prime Coat", start: 20, dur: 3, phase: "Surface" },
    { task: "Wearing Course", start: 22, dur: 7, phase: "Surface" },
    { task: "Plaster Work", start: 19, dur: 8, phase: "Drain" },
    { task: "Finishing", start: 28, dur: 3, phase: "Prep" },
  ];
  const phaseColor = { Earthwork: "#222", Base: "#444", Drain: "#666", HBB: "#888", Surface: "#555", Prep: "#bbb" };
  const phaseText = { Earthwork: "#fff", Base: "#fff", Drain: "#fff", HBB: "#fff", Surface: "#fff", Prep: "#333" };

  return (
    <div style={S.page}>
      <div style={S.header}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.7rem" }}>
          <div>
            <div style={{ fontSize: "1.25rem", fontWeight: "700" }}>সিভিল ইঞ্জিনিয়ারিং কনসালট্যান্ট সিস্টেম</div>
            <div style={{ fontSize: "0.73rem", color: "#aaa", marginTop: "0.15rem" }}>Border Road — Rangamati, Khagrachori & Bandorban | Pre-Assessment + Machine Spec Check + BOQ</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.65rem" }}>
            <span style={{ color: "#aaa", fontSize: "0.75rem" }}>রোড দৈর্ঘ্য (km):</span>
            <input type="number" min={0.1} max={50} step={0.1} value={km} onChange={e => setKm(Math.max(0.1, Number(e.target.value)))} style={S.input} />
            <div style={{ background: "#fff", color: "#111", padding: "0.38rem 0.85rem", borderRadius: "3px", fontWeight: "700", fontSize: "0.85rem" }}>৳ {fmtL(grandTotal)}</div>
          </div>
        </div>
      </div>

      <div style={S.tabBar}>
        {TABS.map(t => <button key={t.id} onClick={() => setTab(t.id)} style={S.tabBtn(tab === t.id)}>{t.label}</button>)}
      </div>

      <div style={S.body}>

        {tab === "preassess" && <AssessmentTab km={km} />}

        {tab === "overview" && (
          <>
            <div style={S.statGrid}>
              <StatCard label="রোড দৈর্ঘ্য" value={`${km} km`} />
              <StatCard label="মোট শ্রমিক" value={totalLaborCount + " জন"} sub="কোয়ান্টিটি ভিত্তিক" />
              <StatCard label="মোট মেশিন" value={machines.reduce((s, m) => s + m.needed, 0) + " টি"} />
              <StatCard label="মেশিন সাশ্রয়" value={"৳ " + fmtL(savings)} />
              <StatCard label="লোকবল" value={"৳ " + fmtL(laborT)} />
              <StatCard label="মেশিনারিজ" value={"৳ " + fmtL(machineryT)} />
              <StatCard label="মালামাল+পেভমেন্ট" value={"৳ " + fmtL(flexT + hbbT + udrT + ldrT)} />
              <StatCard label="গ্র্যান্ড টোটাল" value={"৳ " + fmtL(grandTotal)} />
            </div>
            <div style={S.card}>
              <div style={S.cardTitle}>ব্যয় বিভাজন</div>
              <Tbl
                heads={[{ label: "বিবরণ", left: true }, { label: "মোট (৳)" }, { label: "লক্ষ" }, { label: "%" }]}
                rows={[
                  ["ফ্লেক্সিবল পেভমেন্ট", fmt(flexT), fmtL(flexT), ((flexT / grandTotal) * 100).toFixed(1) + "%"],
                  ["HBB Hard Shoulder", fmt(hbbT), fmtL(hbbT), ((hbbT / grandTotal) * 100).toFixed(1) + "%"],
                  ["U-Type Side Drain", fmt(udrT), fmtL(udrT), ((udrT / grandTotal) * 100).toFixed(1) + "%"],
                  ["L-Type Side Drain", fmt(ldrT), fmtL(ldrT), ((ldrT / grandTotal) * 100).toFixed(1) + "%"],
                  ["লোকবল", fmt(laborT), fmtL(laborT), ((laborT / grandTotal) * 100).toFixed(1) + "%"],
                  ["মেশিনারিজ (Optimized)", fmt(machineryT), fmtL(machineryT), ((machineryT / grandTotal) * 100).toFixed(1) + "%"],
                  ["পরিবহন", fmt(matTransTotal), fmtL(matTransTotal), ((matTransTotal / grandTotal) * 100).toFixed(1) + "%"],
                  ["Contingency 5%", fmt(contingency), fmtL(contingency), "5.0%"],
                ]}
                grandRow={["গ্র্যান্ড টোটাল", fmt(grandTotal), fmtL(grandTotal), "100%"]}
              />
            </div>
          </>
        )}

        {tab === "boq" && (
          <>
            {[
              { title: "ফ্লেক্সিবল পেভমেন্ট", items: flexItems, total: flexT },
              { title: "HBB Hard Shoulder", items: hbbItems, total: hbbT },
              { title: "U-Type Drain", items: udrItems, total: udrT },
              { title: "L-Type Drain", items: ldrItems, total: ldrT },
            ].map((sec, si) => (
              <div key={si} style={S.card}>
                <div style={S.cardTitle}>{sec.title} — {km} km</div>
                <Tbl
                  heads={[{ label: "আইটেম", left: true }, { label: "পরিমাণ" }, { label: "রেট (৳)" }, { label: "মোট (৳)" }]}
                  rows={sec.items.map(i => [i.name, fmtQ(i.qty), fmt(i.rate), { val: fmt(i.amount), bold: true }])}
                  totalRow={["মোট", "", "", fmt(sec.total)]}
                />
              </div>
            ))}
          </>
        )}

        {tab === "materials" && <MaterialSummaryTab items={allBoqItems} km={km} />}

        {tab === "labor" && (
          <div style={S.card}>
            <div style={S.cardTitle}>লোকবল — কোয়ান্টিটি ভিত্তিক</div>
            <Tbl
              heads={[{ label: "ভূমিকা", left: true }, { label: "দক্ষতা" }, { label: "Phase" }, { label: "সংখ্যা" }, { label: "রেট" }, { label: "দিন" }, { label: "মোট (৳)" }]}
              rows={laborList.map(l => [
                l.role,
                { jsx: <span style={S.pill(l.skill)}>{l.skill}</span> },
                { jsx: <span style={S.phasePill(l.phase.split(" ")[0])}>{l.phase}</span> },
                { jsx: <b>{l.count} জন</b> },
                fmt(l.rate),
                l.days,
                { val: fmt(l.total), bold: true },
              ])}
              totalRow={["মোট", "", "", totalLaborCount + " জন", "", "", fmt(laborT)]}
            />
          </div>
        )}

        {tab === "machinery" && (
          <>
            <div style={S.card}>
              <div style={S.cardTitle}>মেশিনারিজ — উৎপাদন ও দক্ষতা ভিত্তিক</div>
              <div style={S.statGrid}>
                <StatCard label="মোট মেশিন" value={machines.reduce((s, m) => s + m.needed, 0) + " টি"} />
                <StatCard label="কাজের ব্যয়" value={"৳ " + fmtL(machineryWorkT)} />
                <StatCard label="Mob/Demob" value={"৳ " + fmtL(machineryMobT)} />
                <StatCard label="মোট" value={"৳ " + fmtL(machineryT)} />
                <StatCard label="সাশ্রয়" value={"৳ " + fmtL(savings)} sub="অপ্টিমাইজড" />
              </div>
              <Tbl
                heads={[{ label: "মেশিন", left: true }, { label: "Phase" }, { label: "কাজ" }, { label: "দক্ষতা" }, { label: "প্রয়োজন" }, { label: "D(আসা)" }, { label: "D(যাওয়া)" }, { label: "দিন" }, { label: "মোট (৳)" }]}
                rows={machines.map(m => [
                  m.name,
                  { jsx: <span style={S.phasePill(m.phase)}>{m.phase}</span> },
                  fmt(m.totalWork) + " " + m.unit,
                  (m.eff * 100).toFixed(0) + "%",
                  { jsx: <span style={{ fontWeight: "700", background: "#111", color: "#fff", padding: "0.1rem 0.4rem", borderRadius: "2px" }}>{m.needed}</span> },
                  "D" + m.arrive, "D" + m.depart, m.days + "d",
                  { val: fmt(m.total), bold: true },
                ])}
                totalRow={["মোট", "", "", "", machines.reduce((s, m) => s + m.needed, 0) + " টি", "", "", "", fmt(machineryT)]}
              />
            </div>
            <div style={S.card}>
              <div style={S.cardTitle}>মেশিন শিডিউল গ্যান্ট</div>
              <MachineGantt machines={machines} />
              <div style={{ ...S.infoBox, marginTop: "0.6rem" }}>সাশ্রয়: ৳ {fmtL(savings)} | রঙিন = সক্রিয় | ধূসর = সাইটে নেই</div>
            </div>
          </>
        )}

        {tab === "transport" && (
          <>
            <div style={S.card}>
              <div style={S.cardTitle}>মালামাল পরিবহন</div>
              <Tbl
                heads={[{ label: "বিবরণ", left: true }, { label: "ট্রিপ" }, { label: "দূরত্ব" }, { label: "রেট" }, { label: "মোট (৳)" }]}
                rows={[
                  ["বালু পরিবহন", Math.ceil((Q.uSand + Q.lSand) / 8), "15-25 km", "4,500", fmt(Math.ceil((Q.uSand + Q.lSand) / 8) * 4500)],
                  ["ইট পরিবহন", Math.round(km * 12), "20-40 km", "5,500", fmt(Math.round(km * 12) * 5500)],
                  ["Aggregate/SB", Math.ceil((Q.subBase + Q.aggBase) / 10), "25-50 km", "4,800", fmt(Math.ceil((Q.subBase + Q.aggBase) / 10) * 4800)],
                  ["বিটুমেন", Math.round(km * 2), "Dhaka→Site", "18,000", fmt(Math.round(km * 2) * 18000)],
                  ["সিমেন্ট", Math.round(km * 3), "30-60 km", "6,000", fmt(Math.round(km * 3) * 6000)],
                  ["মাটি অপসারণ", Math.ceil(Q.boxCutting / 8), "10-15 km", "3,500", fmt(Math.ceil(Q.boxCutting / 8) * 3500)],
                ]}
                totalRow={["মোট", "", "", "", fmt(matTransTotal)]}
              />
            </div>
            <div style={S.card}>
              <div style={S.cardTitle}>মেশিন Mob/Demob</div>
              <Tbl
                heads={[{ label: "মেশিন", left: true }, { label: "সংখ্যা" }, { label: "To Site (৳)" }, { label: "From Site (৳)" }, { label: "মোট (৳)" }]}
                rows={machines.map(m => [m.name, m.needed, fmt(m.mob), fmt(m.mob), { val: fmt(m.mobCost), bold: true }])}
                totalRow={["মোট", "", "", "", fmt(machineryMobT)]}
              />
            </div>
          </>
        )}

        {tab === "verify" && (
          <div style={S.card}>
            <div style={S.cardTitle}>কোয়ান্টিটি যাচাই</div>
            <Tbl
              heads={[{ label: "আইটেম", left: true }, { label: "সূত্র" }, { label: "প্রত্যাশিত" }, { label: "গণনাকৃত" }, { label: "অবস্থা" }]}
              rows={[
                ["Box Cutting", `${fmt(len)}×5.5×0.60×1.25`, fmtQ(round2(len * 5.5 * 0.6 * CF.soil)), fmtQ(Q.boxCutting), { jsx: <span style={{ background: "#111", color: "#fff", padding: "0.1rem 0.35rem", borderRadius: "2px", fontSize: "0.65rem" }}>✔ OK</span> }],
                ["ISG", `${fmt(len)}×5.5×0.20×1.25`, fmtQ(round2(len * 5.5 * 0.2 * CF.soil)), fmtQ(Q.isg), { jsx: <span style={{ background: "#111", color: "#fff", padding: "0.1rem 0.35rem", borderRadius: "2px", fontSize: "0.65rem" }}>✔ OK</span> }],
                ["Sub-Base", `${fmt(len)}×5.5×0.20×1.20`, fmtQ(round2(len * 5.5 * 0.2 * CF.subBase)), fmtQ(Q.subBase), { jsx: <span style={{ background: "#111", color: "#fff", padding: "0.1rem 0.35rem", borderRadius: "2px", fontSize: "0.65rem" }}>✔ OK</span> }],
                ["Agg. Base", `${fmt(len)}×5.5×0.20×1.18`, fmtQ(round2(len * 5.5 * 0.2 * CF.aggregateBase)), fmtQ(Q.aggBase), { jsx: <span style={{ background: "#111", color: "#fff", padding: "0.1rem 0.35rem", borderRadius: "2px", fontSize: "0.65rem" }}>✔ OK</span> }],
                ["Wearing Course", `${fmt(len)}×5.5×0.05×1.05`, fmtQ(round2(len * 5.5 * 0.05 * CF.bitumin)), fmtQ(Q.wearingCourse), { jsx: <span style={{ background: "#111", color: "#fff", padding: "0.1rem 0.35rem", borderRadius: "2px", fontSize: "0.65rem" }}>✔ OK</span> }],
              ]}
            />
          </div>
        )}

        {tab === "histogram" && (
          <div style={S.card}>
            <div style={S.cardTitle}>ব্যয় বিতরণ হিস্টোগ্রাম</div>
            <BarChart data={[
              { label: "পেভমেন্ট", value: flexT, color: "#111", fmt: fmtL(flexT) },
              { label: "HBB", value: hbbT, color: "#333", fmt: fmtL(hbbT) },
              { label: "U-Drain", value: udrT, color: "#555", fmt: fmtL(udrT) },
              { label: "L-Drain", value: ldrT, color: "#666", fmt: fmtL(ldrT) },
              { label: "লোকবল", value: laborT, color: "#777", fmt: fmtL(laborT) },
              { label: "মেশিনারিজ", value: machineryT, color: "#888", fmt: fmtL(machineryT) },
              { label: "পরিবহন", value: matTransTotal, color: "#999", fmt: fmtL(matTransTotal) },
            ]} />
          </div>
        )}

        {tab === "gantt" && (
          <>
            <div style={S.card}>
              <div style={S.cardTitle}>কাজের গ্যান্ট চার্ট — ৩০ দিন</div>
              <div style={{ overflowX: "auto" }}>
                <div style={{ minWidth: "860px" }}>
                  <div style={{ display: "flex", paddingLeft: "180px", marginBottom: "3px" }}>
                    {Array.from({ length: 30 }, (_, i) => (
                      <div key={i} style={{ flex: 1, textAlign: "center", fontSize: "0.57rem", color: "#888", borderLeft: i % 7 === 0 ? "1px solid #ddd" : "none" }}>{i + 1}</div>
                    ))}
                  </div>
                  {ganttTasks.map((g, gi) => (
                    <div key={gi} style={{ display: "flex", alignItems: "center", marginBottom: "3px" }}>
                      <div style={{ width: "180px", fontSize: "0.67rem", paddingRight: "5px", textAlign: "right", color: "#333", flexShrink: 0 }}>{g.task}</div>
                      <div style={{ flex: 1, position: "relative", height: "17px", background: "#f0f0f0", borderRadius: "2px" }}>
                        <div style={{ position: "absolute", left: `${((g.start - 1) / 30) * 100}%`, width: `${(g.dur / 30) * 100}%`, height: "100%", background: phaseColor[g.phase] || "#555", borderRadius: "2px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.57rem", color: phaseText[g.phase] || "#fff", fontWeight: "600", overflow: "hidden" }}>
                          {g.dur > 2 ? `D${g.start}-D${g.start + g.dur - 1}` : ""}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div style={S.card}>
              <div style={S.cardTitle}>মেশিন গ্যান্ট</div>
              <MachineGantt machines={machines} />
            </div>
          </>
        )}

        {tab === "rates" && (
          <div style={S.card}>
            <div style={S.cardTitle}>বাজারমূল্য রেফারেন্স — ২০২৪</div>
            <Tbl
              heads={[{ label: "উপকরণ", left: true }, { label: "একক" }, { label: "RHD/PWD রেট" }, { label: "বাজার রেট" }, { label: "ব্যবহৃত" }]}
              rows={[
                ["বিটুমেন Grade 60/70", "MT", "৳১,১৫,০০০", "৳১,২০,০০০-১,২৫,০০০", "৳১,২০,০০০"],
                ["Stone Chips (20mm)", "cum", "৳২,৮০০", "৳৩,০০০-৩,৫০০", "৳২,৮০০"],
                ["বালু (Sylhet)", "cum", "৳৯০০", "৳৮০০-১,২০০", "৳৯০০"],
                ["ইট (১ম শ্রেণী)", "হাজার", "৳১৪,৫০০", "৳১৪,০০০-১৬,০০০", "৳১৫,০০০"],
                ["সিমেন্ট OPC", "bag", "৳৫৩০", "৳৫২০-৫৮০", "৳৫৫০"],
                ["দক্ষ মিস্ত্রি", "দিন", "৳৮৫০", "৳৮০০-১০০০", "৳৯০০"],
                ["অদক্ষ শ্রমিক", "দিন", "৳৫৫০", "৳৫০০-৬৫০", "৳৬০০"],
                ["Excavator PC-200", "ঘণ্টা", "৳৩,২০০", "৳৩,৫০০-৪,০০০", "৳৩,৫০০"],
                ["Motor Grader", "ঘণ্টা", "৳৫,৫০০", "৳৬,০০০-৭,০০০", "৳৬,০০০"],
                ["Asphalt Plant 60TPH", "ঘণ্টা", "৳২২,০০০", "৳২৫,০০০-৩০,০০০", "৳২৫,০০০"],
              ]}
            />
            <div style={{ ...S.infoBox, marginTop: "0.75rem" }}>
              📚 RHD SOR 2023 | LGED SOR 2023 | PWD Schedule 2023 | GDS Manual 2005 | AASHTO 1993
            </div>
          </div>
        )}
      </div>

      <div style={{ background: "#111", color: "#666", textAlign: "center", padding: "0.6rem", fontSize: "0.68rem" }}>
        Civil Engineering Consultant System | Pre-Assessment + Machine Spec Check + BOQ + Machinery Optimization | RHD GDS 2005 | AASHTO 1993 | PWD/RHD/LGED SOR 2023
      </div>
    </div>
  );
}