// UPSC syllabus taxonomy. Each theme carries keyword signals, a Mains angle
// and a Prelims focus line used to build revision notes and practice MCQs.
export const THEMES = [
  {
    id: "gs1-culture",
    paper: "GS-1",
    name: "Art, Culture & Heritage",
    mainsAngle:
      "For Mains, connect it to India's cultural continuity, heritage conservation and the creative economy.",
    prelimsFocus: "note the site, period, institution and cultural tradition involved",
    strong: [
      "unesco", "world heritage", "heritage site", "monument", "excavation", "archaeological",
      "inscription", "manuscript", "museum", "classical dance", "folk art", "tribal art",
      "intangible heritage", "cultural heritage", "temple architecture", "buddhist site",
    ],
    medium: [
      "culture", "festival", "tradition", "art form", "sculpture", "painting", "craft",
      "literature", "language", "archive", "conservation of heritage", "tourist circuit",
    ],
  },
  {
    id: "gs1-history",
    paper: "GS-1",
    name: "Modern History & Freedom Struggle",
    mainsAngle:
      "For Mains, place it in the wider narrative of colonial rule, the freedom struggle and constitutional evolution.",
    prelimsFocus: "remember the personality, movement, year and associated institution",
    strong: [
      "freedom fighter", "freedom struggle", "independence movement", "quit india",
      "non-cooperation", "civil disobedience", "colonial rule", "british india",
      "partition of india", "constituent assembly", "revolt of 1857", "swadeshi",
    ],
    medium: [
      "gandhi", "nehru", "ambedkar", "patel", "subhas chandra bose", "tilak",
      "centenary", "bicentenary", "memorial", "historical", "colonial", "archive",
    ],
  },
  {
    id: "gs1-geography",
    paper: "GS-1",
    name: "Geography & Physical Environment",
    mainsAngle:
      "For Mains, link it to physical geography, regional disparities and climate-resilient planning.",
    prelimsFocus: "locate the region on a map and note the physical process involved",
    strong: [
      "himalaya", "glacier", "monsoon", "river system", "plate tectonics", "ocean current",
      "coastal erosion", "el nino", "la nina", "permafrost", "landform", "watershed",
      "geomorphology", "rain shadow", "tropical cyclone", "sea level rise",
    ],
    medium: [
      "river", "delta", "plateau", "mountain", "valley", "coastal", "island", "ocean",
      "climate zone", "rainfall", "groundwater", "map", "latitude", "longitude",
    ],
  },
  {
    id: "gs1-society",
    paper: "GS-1",
    name: "Society, Demography & Social Issues",
    mainsAngle:
      "For Mains, connect it to inclusion, demographic change and the rights of vulnerable groups.",
    prelimsFocus: "note the population indicator, social group and scheme involved",
    strong: [
      "census", "population", "migration", "urbanisation", "urbanization", "poverty line",
      "inequality", "gender gap", "caste census", "child marriage", "ageing population",
      "demographic dividend", "female labour force", "social exclusion",
    ],
    medium: [
      "literacy", "health", "education", "tribe", "dalit", "adivasi", "minority",
      "women", "children", "elderly", "disability", "nutrition", "household",
      "slum", "rural development", "social sector",
    ],
  },
  {
    id: "gs2-polity",
    paper: "GS-2",
    name: "Polity & Constitution",
    mainsAngle:
      "For Mains, examine the constitutional mandate, institutional independence, federal balance and accountability.",
    prelimsFocus: "note the article, institution, jurisdiction and constitutional provision",
    strong: [
      "constitution", "supreme court", "high court", "parliament", "rajya sabha", "lok sabha",
      "constitutional amendment", "fundamental rights", "directive principles", "judicial review",
      "election commission", "governor", "president of india", "chief justice", "tribunal",
      "panchayat", "municipality", "federalism", "ordinance", "money bill", "speaker",
      "attorney general", "comptroller and auditor general", "cag", "delimitation",
      "general election", "assembly election", "bye-election", "electoral roll",
    ],
    medium: [
      "bill", "act", "judgment", "verdict", "petition", "court", "judiciary", "legislation",
      "assembly", "mla", "mp", "cabinet", "ministry", "governance", "constitutional body",
      "statutory body", "rules", "notification", "committee", "election", "voters", "ballot",
      "midterm",
    ],
  },
  {
    id: "gs2-governance",
    paper: "GS-2",
    name: "Governance, Schemes & Transparency",
    mainsAngle:
      "For Mains, assess delivery capacity, transparency, last-mile implementation and citizen-centric governance.",
    prelimsFocus: "note the scheme name, ministry, beneficiary group and launch year",
    strong: [
      "central scheme", "flagship scheme", "cabinet approves", "union cabinet", "e-governance",
      "digital public infrastructure", "right to information", "rti", "lokpal", "lokayukta",
      "direct benefit transfer", "jan dhan", "aadhaar", "digilocker", "umang",
      "mission karmayogi", "good governance", "citizen charter", "public grievance",
    ],
    medium: [
      "scheme", "yojana", "mission", "policy", "guidelines", "implementation", "beneficiary",
      "subsidy", "portal", "database", "service delivery", "district administration",
      "capacity building", "reform", "dashboard", "transparency", "accountability",
      "budget allocation", "ministry launches",
    ],
  },
  {
    id: "gs2-social-justice",
    paper: "GS-2",
    name: "Social Justice & Welfare",
    mainsAngle:
      "For Mains, link it to equity, entitlement design and the effectiveness of welfare delivery.",
    prelimsFocus: "note the beneficiary category, entitlement and administering ministry",
    strong: [
      "reservation", "scheduled caste", "scheduled tribe", "other backward class", "obc",
      "ayushman bharat", "poshan abhiyaan", "mid-day meal", "pm poshan", "labour code",
      "minimum wage", "human rights", "child rights", "transgender", "persons with disabilities",
      "welfare scheme", "social security", "pension scheme", "health insurance",
    ],
    medium: [
      "welfare", "pension", "health", "education", "school", "hospital", "nutrition",
      "women empowerment", "self-help group", "livelihood", "maternity", "creche",
      "shelter", "rehabilitation", "social justice", "empowerment", "vulnerable",
    ],
  },
  {
    id: "gs2-ir",
    paper: "GS-2",
    name: "International Relations",
    mainsAngle:
      "For Mains, connect it to India's strategic interests, multilateral positioning and bilateral relations.",
    prelimsFocus: "note the grouping, treaty, summit and member countries involved",
    strong: [
      "united states", "u.s.", "washington", "white house", "bilateral", "multilateral",
      "diplomacy", "united nations", "un security council", "unsc",
      "g20", "g7", "brics", "quad", "sco", "asean", "saarc", "bimstec", "wto",
      "imf", "world bank", "sanctions", "foreign policy", "diplomatic", "diaspora",
      "ceasefire", "peace talks", "treaty", "summit", "state visit", "joint statement",
      "indo-pacific", "global south", "unfccc", "cop30", "cop29", "opec",
    ],
    medium: [
      "trump", "india and", "external affairs", "ambassador", "consulate", "delegation", "border talks",
      "defence pact", "trade agreement", "free trade agreement", "fta", "visa",
      "refugee", "humanitarian aid", "peacekeeping", "alliance", "strategic partnership",
      "foreign minister", "prime minister visit",
    ],
  },
  {
    id: "gs3-economy",
    paper: "GS-3",
    name: "Economy & Banking",
    mainsAngle:
      "For Mains, connect it to growth, inflation, fiscal-monetary coordination and financial stability.",
    prelimsFocus: "note the rate, indicator, institution and direction of change",
    strong: [
      "rbi", "reserve bank", "repo rate", "reverse repo", "monetary policy", "inflation",
      "consumer price index", "cpi", "wholesale price index", "wpi", "gdp", "gva",
      "fiscal deficit", "revenue deficit", "current account deficit", "gst", "sebi",
      "banking", "npa", "rupee", "forex reserves", "monetary policy committee",
      "financial stability", "capital market", "bond market", "credit growth",
    ],
    medium: [
      "economy", "economic growth", "budget", "tax", "taxation", "export", "import",
      "trade deficit", "trade", "investment", "fdi", "msme", "disinvestment", "ipo",
      "stock market", "sensex", "nifty", "insurance", "loan", "interest rate", "subsidy",
      "manufacturing", "industrial output", "service sector", "consumption", "demand",
    ],
  },
  {
    id: "gs3-agriculture",
    paper: "GS-3",
    name: "Agriculture & Food Security",
    mainsAngle:
      "For Mains, link it to farmer incomes, food security, input efficiency and agri-market reform.",
    prelimsFocus: "note the crop, season, support price and implementing agency",
    strong: [
      "agriculture", "farmer", "minimum support price", "msp", "kharif", "rabi", "zaid",
      "fertiliser", "fertilizer", "irrigation", "food security", "pm-kisan", "pm kisan",
      "horticulture", "dairy", "fisheries", "agri-tech", "soil health card", "procurement",
      "food corporation", "public distribution system", "pds", "crop insurance",
    ],
    medium: [
      "crop", "wheat", "rice", "pulses", "oilseed", "sugarcane", "cotton", "millet",
      "harvest", "sowing", "farm", "rural economy", "agricultural produce", "mandi",
      "cooperative", "seed", "livestock", "poultry", "agro",
    ],
  },
  {
    id: "gs3-environment",
    paper: "GS-3",
    name: "Environment, Ecology & Climate",
    mainsAngle:
      "For Mains, connect it to conservation, climate commitments and sustainable development.",
    prelimsFocus: "note the pollutant or species, the regulating body and the target year",
    strong: [
      "climate change", "emission", "carbon", "net zero", "biodiversity", "wildlife",
      "tiger reserve", "elephant corridor", "wetland", "ramsar", "pollution", "air quality",
      "plastic waste", "environment impact assessment", "eia", "deforestation", "mangrove",
      "renewable energy", "green hydrogen", "solar power", "wind energy", "ecosystem",
      "cheetah", "ganges dolphin", "great indian bustard", "cop30", "cop29", "unfccc",
      "ipcc", "carbon credit", "circular economy", "ozone", "glacier melt",
    ],
    medium: [
      "forest", "wildlife sanctuary", "national park", "species", "habitat", "conservation",
      "climate", "green", "sustainability", "recycling", "waste", "water pollution",
      "river pollution", "stubble burning", "heatwave", "rainfall deficit", "monsoon",
      "solar", "wind", "hydro", "biofuel", "electric vehicle", "ev", "energy transition",
      "green bond", "carbon market", "afforestation",
    ],
  },
  {
    id: "gs3-scitech",
    paper: "GS-3",
    name: "Science, Technology & Space",
    mainsAngle:
      "For Mains, assess the scientific capability, indigenisation, regulation and strategic implications.",
    prelimsFocus: "note the mission, agency, technology and first-of-its-kind detail",
    strong: [
      "isro", "drdo", "satellite launch", "rocket launch", "space mission", "artificial intelligence",
      "semiconductor", "quantum computing", "quantum", "genome", "gene editing", "vaccine",
      "biotechnology", "nuclear reactor", "nuclear power", "5g", "6g", "cybersecurity",
      "deepfake", "robotics", "telescope", "supercomputer", "chandrayaan", "gaganyaan",
      "aditya-l1", "bharatiya antariksh station",
    ],
    medium: [
      "science", "technology", "research", "innovation", "startup", "digital", "chip", "satellite",
      "data protection", "privacy", "algorithm", "drone technology", "battery",
      "electric vehicle", "space", "orbit", "launch vehicle", "laboratory", "patent",
      "scientific", "study finds", "breakthrough", "ai model", "machine learning",
    ],
  },
  {
    id: "gs3-security",
    paper: "GS-3",
    name: "Internal & External Security",
    mainsAngle:
      "For Mains, examine the threat perception, defence preparedness and inter-agency coordination.",
    prelimsFocus: "note the force, exercise, weapon system and bordering region",
    strong: [
      "terrorism", "terror attack", "naxal", "left wing extremism", "insurgency",
      "defence", "indian army", "indian navy", "air force", "missile test", "ballistic missile",
      "hypersonic", "drone attack", "line of control", "loc", "cyber attack", "cyber security",
      "paramilitary", "crpf", "bsf", "itbp", "military exercise", "arms deal", "ceasefire violation",
      "coast guard", "internal security", "national security",
    ],
    medium: [
      "security", "border", "army", "navy", "aircraft", "warship", "submarine", "radar",
      "defence procurement", "military", "intelligence", "police", "ammunition", "weapon",
      "strategic", "surveillance", "insurgent", "militant", "encounter", "forces",
    ],
  },
  {
    id: "gs3-infrastructure",
    paper: "GS-3",
    name: "Infrastructure, Energy & Industry",
    mainsAngle:
      "For Mains, link it to connectivity, energy transition, investment cycles and regional development.",
    prelimsFocus: "note the corridor, project cost, implementing agency and location",
    strong: [
      "highway", "expressway", "railway", "metro rail", "vande bharat", "port", "airport",
      "power grid", "electricity", "discom", "transmission line", "oil refinery", "gas pipeline",
      "telecom", "spectrum auction", "smart city", "affordable housing", "jal jeevan",
      "water supply", "sewage", "urban transport", "logistics", "industrial corridor",
      "semiconductor fab", "battery plant", "energy security",
    ],
    medium: [
      "infrastructure", "connectivity", "construction", "project", "investment", "capex",
      "housing", "road", "bridge", "tunnel", "rail", "energy", "power", "coal", "crude oil",
      "natural gas", "lng", "pipeline", "shipping", "aviation", "urban development",
      "industrial park", "manufacturing plant", "steel", "cement", "mining",
    ],
  },
  {
    id: "gs3-disaster",
    paper: "GS-3",
    name: "Disaster Management",
    mainsAngle:
      "For Mains, connect it to disaster risk reduction, early warning and climate adaptation.",
    prelimsFocus: "note the hazard type, affected region, agency and relief mechanism",
    strong: [
      "disaster management", "ndrf", "national disaster", "cyclone", "flood", "flash flood",
      "earthquake", "landslide", "cloudburst", "drought", "heatwave", "heat wave",
      "forest fire", "wildfire", "tsunami", "evacuation", "relief camp", "early warning system",
      "disaster risk reduction", "sendai framework",
    ],
    medium: [
      "disaster", "relief", "rescue", "rehabilitation", "vulnerable", "resilience",
      "emergency", "alert", "warning", "affected", "casualties", "damage", "compensation",
      "shelter", "embankment", "dam", "reservoir",
    ],
  },
  {
    id: "gs4-ethics",
    paper: "GS-4",
    name: "Ethics, Integrity & Accountability",
    mainsAngle:
      "For Mains, use it to discuss probity, accountability and the ethical use of public office.",
    prelimsFocus: "note the institution, statutory backing and accountability mechanism",
    strong: [
      "corruption", "bribery", "probity", "conflict of interest", "whistleblower",
      "central vigilance commission", "cvc", "lokpal", "ethical", "integrity pact",
      "moral", "code of conduct", "disciplinary action", "misconduct", "transparency audit",
    ],
    medium: [
      "ethics", "accountability", "transparency", "vigilance", "investigation", "inquiry",
      "suspension", "chargesheet", "governance failure", "public office", "civil servant",
    ],
  },
];

export const THEME_BY_ID = new Map(THEMES.map((t) => [t.id, t]));

// Noise that should not reach the digest unless a strong policy signal exists.
export const NEGATIVE_SIGNALS = [
  "cricket", "ipl", "test match", "odi series", "t20", "football", "olympic", "asian games",
  "hockey", "tennis", "badminton", "kabaddi", "sports", "bollywood", "box office", "film review",
  "movie", "actor", "actress", "celebrity", "web series", "ott release", "trailer", "song launch",
  "music album", "entertainment", "oscar", "grammy", "horoscope", "zodiac", "fashion", "recipe",
  "relationship", "viral video", "murder", "rape", "robbery", "theft", "road accident",
  "fire incident", "stampede", "obituary", "weather update", "traffic advisory", "recruitment",
  "vacancy", "exam result", "admit card", "answer key", "cutoff", "gold rate today",
  "petrol price today", "sensex today", "nifty today", "stock tips", "share price target",
  "ipo listing gain", "box office collection", "troll", "meme", "sensex", "nifty",
  "investor wealth", "stock market rally", "share market", "bomb threat", "coaches gutted",
  "ran out of fuel", "news brief", "evening brief", "live updates", "live blog",
  "web story", "watch:", "video:", "who is", "takes charge", "takes over as",
  "encounter", "bail", "remand", "acquit", "acquitted", "convict", "convicted", "shot", "car accident", "accident",
  "ganja", "narcotics", "smuggling", "security cover", "security category",
  "counting of votes", "zptc", "mptc", "health quiz", "graveyard", "one-way traffic",
  "net profit", "quarterly results", "q1 results", "q2 results", "q3 results", "q4 results",
  "profit rises", "revenue rises", "shares rise", "stock surges", "recharge plan",
  "tariff plan", "postpaid", "prepaid", "data plan", "shooting", "massacre", "stabbed",
  "houseboat", "backwaters", "rupee strengthens", "rupee weakens", "closes at",
];
