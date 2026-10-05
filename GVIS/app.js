const state = {
    map: null,
    view: null,
    baseLayer: null,
    searchSource: null,
    resultSource: null,
    imageSource: null,
    popupOverlay: null,
    popupElement: null,
    center: [20, 0],
    searchCenterReady: false,
    importedFeatures: [],
    reviewRecords: [],
    selectedEntities: new Set(),
    dynamicEntities: [],
    measuredFeaturePool: [],
    imageHints: [],
    results: [],
    loading: false,
};

const basemapConfigs = {
    voyager: {
        urls: [
        "https://a.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png",
        "https://b.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png",
        "https://c.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png",
        "https://d.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png",
        ],
        attribution: '&copy; OpenStreetMap &copy; CARTO',
    },
    light: {
        urls: [
        "https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png",
        "https://b.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png",
        "https://c.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png",
        "https://d.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png",
        ],
        attribution: '&copy; OpenStreetMap &copy; CARTO',
    },
    dark: {
        urls: [
        "https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png",
        "https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png",
        "https://c.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png",
        "https://d.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png",
        ],
        attribution: '&copy; OpenStreetMap &copy; CARTO',
    },
    satellite: {
        urls: [
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        ],
        attribution: "Tiles &copy; Esri",
    },
};

const overpassEndpoints = [
    "https://overpass.kumi.systems/api/interpreter",
    "https://overpass-api.de/api/interpreter",
    "https://overpass.osm.ch/api/interpreter",
];

const queryLexicon = {
    building: ["haus", "haeuser", "häuser", "wohngebiet", "einfamilienhaus", "gebaeude", "gebäude", "siedlung", "residential"],
    vegetation: ["wald", "baeume", "bäume", "vegetation", "park", "gruen", "grün", "wiese", "field", "forest"],
    poi: ["poi", "laden", "supermarkt", "restaurant", "kirche", "schule", "spielplatz", "tankstelle", "hotel", "cafe", "bank"],
    transport: ["strasse", "straße", "weg", "radweg", "haltestelle", "bus", "bahn", "parkplatz", "bruecke", "brücke"],
    water: ["wasser", "fluss", "bach", "see", "ufer", "teich", "river"],
};

const tagGroups = {
    building: ["building"],
    vegetation: ["natural", "landuse", "leisure"],
    poi: ["amenity", "shop", "tourism", "historic", "office", "craft"],
    transport: ["highway", "railway", "public_transport", "route", "parking"],
    water: ["water", "waterway", "bridge"],
};

const sourceQueries = {
    building: 'way["building"~"yes|house|detached|semidetached_house|terrace|apartments|residential|school|church|commercial|retail"](around:RADIUS,LAT,LON);',
    vegetation: 'way["natural"~"wood|tree_row|scrub|heath|grassland"](around:RADIUS,LAT,LON);relation["natural"~"wood|scrub|heath|grassland"](around:RADIUS,LAT,LON);way["landuse"~"forest|grass|meadow|orchard|vineyard|recreation_ground"](around:RADIUS,LAT,LON);way["leisure"~"park|garden|nature_reserve|playground"](around:RADIUS,LAT,LON);',
    poi: 'node["amenity"](around:RADIUS,LAT,LON);node["shop"](around:RADIUS,LAT,LON);node["tourism"](around:RADIUS,LAT,LON);node["historic"](around:RADIUS,LAT,LON);way["amenity"](around:RADIUS,LAT,LON);way["shop"](around:RADIUS,LAT,LON);way["tourism"](around:RADIUS,LAT,LON);',
    transport: 'node["highway"~"bus_stop|crossing|traffic_signals"](around:RADIUS,LAT,LON);node["public_transport"](around:RADIUS,LAT,LON);node["railway"~"station|halt|tram_stop"](around:RADIUS,LAT,LON);way["highway"~"primary|secondary|tertiary|residential|footway|cycleway|path"](around:RADIUS,LAT,LON);',
    water: 'node["waterway"](around:RADIUS,LAT,LON);way["waterway"](around:RADIUS,LAT,LON);way["natural"="water"](around:RADIUS,LAT,LON);way["bridge"](around:RADIUS,LAT,LON);',
};

const focusedQueryRules = [
    focusRule("restaurant", "Restaurant", ["restaurant", "essen", "speiselokal"], 'node["amenity"="restaurant"](around:RADIUS,LAT,LON);way["amenity"="restaurant"](around:RADIUS,LAT,LON);'),
    focusRule("cafe", "Cafe", ["cafe", "kaffee"], 'node["amenity"="cafe"](around:RADIUS,LAT,LON);way["amenity"="cafe"](around:RADIUS,LAT,LON);'),
    focusRule("church", "Kirche", ["kirche", "gotteshaus", "kapelle", "church"], 'node["amenity"="place_of_worship"](around:RADIUS,LAT,LON);way["amenity"="place_of_worship"](around:RADIUS,LAT,LON);way["building"="church"](around:RADIUS,LAT,LON);'),
    focusRule("parking", "Parkplatz", ["parkplatz", "parking"], 'node["amenity"="parking"](around:RADIUS,LAT,LON);way["amenity"="parking"](around:RADIUS,LAT,LON);'),
    focusRule("historic", "Historisch", ["historisch", "historische", "denkmal", "monument", "historic"], 'node["historic"](around:RADIUS,LAT,LON);way["historic"](around:RADIUS,LAT,LON);'),
    focusRule("school", "Schule", ["schule", "school"], 'node["amenity"="school"](around:RADIUS,LAT,LON);way["amenity"="school"](around:RADIUS,LAT,LON);'),
    focusRule("playground", "Spielplatz", ["spielplatz", "playground"], 'node["leisure"="playground"](around:RADIUS,LAT,LON);way["leisure"="playground"](around:RADIUS,LAT,LON);'),
    focusRule("supermarket", "Supermarkt", ["supermarkt", "laden", "shop"], 'node["shop"="supermarket"](around:RADIUS,LAT,LON);way["shop"="supermarket"](around:RADIUS,LAT,LON);node["shop"](around:RADIUS,LAT,LON);'),
    focusRule("bus_stop", "Bushaltestelle", ["bus", "bushaltestelle", "haltestelle"], 'node["highway"="bus_stop"](around:RADIUS,LAT,LON);node["public_transport"="platform"](around:RADIUS,LAT,LON);'),
    focusRule("water", "Wasser", ["wasser", "fluss", "bach", "ufer", "bruecke", "brücke"], 'way["waterway"~"river|stream|canal"](around:RADIUS,LAT,LON);node["waterway"~"river|stream|canal"](around:RADIUS,LAT,LON);way["natural"="water"](around:RADIUS,LAT,LON);way["bridge"](around:RADIUS,LAT,LON);'),
    focusRule("forest", "Wald", ["wald", "baeume", "bäume", "vegetation", "park", "wiese"], 'way["landuse"~"forest|meadow|grass|recreation_ground"](around:RADIUS,LAT,LON);way["natural"~"wood|grassland|tree_row|scrub"](around:RADIUS,LAT,LON);way["leisure"~"park|garden"](around:RADIUS,LAT,LON);'),
    focusRule("residential", "Wohngebiet", ["wohngebiet", "haeuser", "häuser", "einfamilienhaus", "siedlung"], 'way["landuse"="residential"](around:RADIUS,LAT,LON);way["building"~"house|detached|semidetached_house|terrace|apartments|residential"](around:RADIUS,LAT,LON);'),
    focusRule("viewpoint", "Aussichtspunkt", ["aussicht", "aussichtspunkt", "viewpoint"], 'node["tourism"="viewpoint"](around:RADIUS,LAT,LON);way["tourism"="viewpoint"](around:RADIUS,LAT,LON);'),
    focusRule("tower_building", "Hochhaus/Turm", ["hochhaus", "turm", "skyscraper", "tower", "markantes gebaeude", "markantes gebäude"], 'node["building"~"tower|office|commercial"](around:RADIUS,LAT,LON);way["building"~"tower|office|commercial"](around:RADIUS,LAT,LON);node["man_made"~"tower|mast"](around:RADIUS,LAT,LON);way["man_made"~"tower|mast"](around:RADIUS,LAT,LON);'),
    focusRule("jentower", "Jentower", ["jentower", "jen tower", "jena tower", "intershop tower", "uniturm", "unithochhaus", "streifenturm"], 'node["name"~"JenTower|Jentower|Jena Tower|Intershop Tower|Universitaetshochhaus|Universitätshochhaus"](around:RADIUS,LAT,LON);way["name"~"JenTower|Jentower|Jena Tower|Intershop Tower|Universitaetshochhaus|Universitätshochhaus"](around:RADIUS,LAT,LON);relation["name"~"JenTower|Jentower|Jena Tower|Intershop Tower|Universitaetshochhaus|Universitätshochhaus"](around:RADIUS,LAT,LON);'),
    focusRule("alley", "Altstadtgasse", ["gasse", "altstadtgasse", "enge gasse", "schmale gasse", "cobblestone alley", "old town alley"], 'way["highway"~"pedestrian|living_street|service|footway"]["name"~"Gasse|gasse|Wagnergasse|Johannisgasse|Jenergasse"](around:RADIUS,LAT,LON);way["highway"~"pedestrian|living_street|service|footway"]["surface"~"sett|cobblestone|paving_stones"](around:RADIUS,LAT,LON);node["amenity"~"restaurant|cafe"]["outdoor_seating"~"yes|seasonal"](around:RADIUS,LAT,LON);way["amenity"~"restaurant|cafe"]["outdoor_seating"~"yes|seasonal"](around:RADIUS,LAT,LON);'),
    focusRule("cobblestone", "Kopfsteinpflaster", ["kopfsteinpflaster", "pflastersteine", "pflastergasse", "cobblestone", "sett", "paving stones"], 'way["surface"~"sett|cobblestone|paving_stones"](around:RADIUS,LAT,LON);way["smoothness"~"bad|intermediate"]["surface"~"paving_stones|sett"](around:RADIUS,LAT,LON);'),
    focusRule("outdoor_seating", "Aussengastronomie", ["aussengastronomie", "aussenbereich", "outdoor seating", "tische draussen", "strassencafe", "street cafe"], 'node["amenity"~"restaurant|cafe|bar|pub"]["outdoor_seating"~"yes|seasonal"](around:RADIUS,LAT,LON);way["amenity"~"restaurant|cafe|bar|pub"]["outdoor_seating"~"yes|seasonal"](around:RADIUS,LAT,LON);'),
    focusRule("church_tower", "Kirchturm", ["kirchturm", "church tower", "kirche turm", "stadtkirche"], 'node["amenity"="place_of_worship"](around:RADIUS,LAT,LON);way["amenity"="place_of_worship"](around:RADIUS,LAT,LON);way["building"~"church|cathedral|chapel"](around:RADIUS,LAT,LON);'),
    focusRule("power_pole", "Strommast", ["strommast", "strommasten", "stromleitung", "power pole", "utility pole", "hochspannung"], 'node["power"~"pole|tower"](around:RADIUS,LAT,LON);way["power"="line"](around:RADIUS,LAT,LON);'),
    focusRule("street_lamp", "Straßenlaterne", ["laterne", "strassenlaterne", "straßenlaterne", "street lamp"], 'node["highway"="street_lamp"](around:RADIUS,LAT,LON);node["amenity"="street_lamp"](around:RADIUS,LAT,LON);'),
    focusRule("road_marking", "Straßenmarkierung", ["strassenbemalung", "straßenbemalung", "strassenmarkierung", "straßenmarkierung", "road marking", "zebrastreifen", "spurpfeil"], 'node["road_marking"](around:RADIUS,LAT,LON);way["road_marking"](around:RADIUS,LAT,LON);node["highway"="crossing"](around:RADIUS,LAT,LON);way["turn:lanes"](around:RADIUS,LAT,LON);way["cycleway"="lane"](around:RADIUS,LAT,LON);'),
    focusRule("traffic_sign", "Verkehrsschild", ["schild", "verkehrsschild", "strassenschild", "straßenschild", "traffic sign"], 'node["traffic_sign"](around:RADIUS,LAT,LON);way["traffic_sign"](around:RADIUS,LAT,LON);way["traffic_sign:forward"](around:RADIUS,LAT,LON);way["traffic_sign:backward"](around:RADIUS,LAT,LON);'),
    focusRule("stop_sign", "Stoppschild", ["stoppschild", "stop schild", "stop sign"], 'node["highway"="stop"](around:RADIUS,LAT,LON);node["traffic_sign"~"stop|STOP|206|R1-1"](around:RADIUS,LAT,LON);'),
    focusRule("speed_limit", "Tempolimit", ["tempolimit", "geschwindigkeitsschild", "speed limit", "maxspeed"], 'node["traffic_sign"~"274|speed|Speed|maxspeed|R2"](around:RADIUS,LAT,LON);way["maxspeed"](around:RADIUS,LAT,LON);'),
    focusRule("country_signs_de", "Deutsche Schilder", ["deutsches schild", "deutsche schilder", "de sign", "german sign"], 'node["traffic_sign"~"DE:"](around:RADIUS,LAT,LON);way["traffic_sign"~"DE:"](around:RADIUS,LAT,LON);way["traffic_sign:forward"~"DE:"](around:RADIUS,LAT,LON);way["traffic_sign:backward"~"DE:"](around:RADIUS,LAT,LON);'),
    focusRule("country_signs_us", "US-Schilder", ["us schild", "usa schild", "american sign", "us sign"], 'node["traffic_sign"~"US:"](around:RADIUS,LAT,LON);way["traffic_sign"~"US:"](around:RADIUS,LAT,LON);way["traffic_sign:forward"~"US:"](around:RADIUS,LAT,LON);way["traffic_sign:backward"~"US:"](around:RADIUS,LAT,LON);'),
];

const countrySignDefinitions = [
    ["DE", "Deutschland", ["deutsch", "german", "de"]],
    ["AT", "Oesterreich", ["oesterreich", "österreich", "austrian", "at"]],
    ["CH", "Schweiz", ["schweiz", "swiss", "ch"]],
    ["FR", "Frankreich", ["frankreich", "french", "fr"]],
    ["IT", "Italien", ["italien", "italian", "it"]],
    ["ES", "Spanien", ["spanien", "spanish", "es"]],
    ["PT", "Portugal", ["portugal", "portuguese", "pt"]],
    ["NL", "Niederlande", ["niederlande", "holland", "dutch", "nl"]],
    ["BE", "Belgien", ["belgien", "belgian", "be"]],
    ["PL", "Polen", ["polen", "polish", "pl"]],
    ["CZ", "Tschechien", ["tschechien", "czech", "cz"]],
    ["SK", "Slowakei", ["slowakei", "slovak", "sk"]],
    ["HU", "Ungarn", ["ungarn", "hungarian", "hu"]],
    ["RO", "Rumaenien", ["rumaenien", "rumänien", "romanian", "ro"]],
    ["BG", "Bulgarien", ["bulgarien", "bulgarian", "bg"]],
    ["HR", "Kroatien", ["kroatien", "croatian", "hr"]],
    ["SI", "Slowenien", ["slowenien", "slovenian", "si"]],
    ["DK", "Daenemark", ["daenemark", "dänemark", "danish", "dk"]],
    ["SE", "Schweden", ["schweden", "swedish", "se"]],
    ["NO", "Norwegen", ["norwegen", "norwegian", "no"]],
    ["FI", "Finnland", ["finnland", "finnish", "fi"]],
    ["EE", "Estland", ["estland", "estonian", "ee"]],
    ["LV", "Lettland", ["lettland", "latvian", "lv"]],
    ["LT", "Litauen", ["litauen", "lithuanian", "lt"]],
    ["GB", "Grossbritannien", ["grossbritannien", "großbritannien", "uk", "british", "gb"]],
    ["IE", "Irland", ["irland", "irish", "ie"]],
    ["US", "USA", ["usa", "us", "american"]],
    ["CA", "Kanada", ["kanada", "canada", "canadian", "ca"]],
    ["MX", "Mexiko", ["mexiko", "mexico", "mexican", "mx"]],
    ["BR", "Brasilien", ["brasilien", "brazil", "brazilian", "br"]],
    ["AR", "Argentinien", ["argentinien", "argentina", "argentinian", "ar"]],
    ["CL", "Chile", ["chile", "chilean", "cl"]],
    ["AU", "Australien", ["australien", "australia", "australian", "au"]],
    ["NZ", "Neuseeland", ["neuseeland", "new zealand", "nz"]],
    ["JP", "Japan", ["japan", "japanese", "jp"]],
    ["KR", "Korea", ["korea", "korean", "kr"]],
    ["TH", "Thailand", ["thailand", "thai", "th"]],
    ["ID", "Indonesien", ["indonesien", "indonesia", "indonesian", "id"]],
    ["MY", "Malaysia", ["malaysia", "malaysian", "my"]],
    ["ZA", "Suedafrika", ["suedafrika", "südafrika", "south africa", "za"]],
    ["TR", "Tuerkei", ["tuerkei", "türkei", "turkey", "turkish", "tr"]],
    ["GR", "Griechenland", ["griechenland", "greece", "greek", "gr"]],
    ["UA", "Ukraine", ["ukraine", "ukrainian", "ua"]],
];

const entityCatalog = [
    entity("oak", "Eiche", "Baumarten", "vegetation", ["eiche", "oak", "quercus"], 'node["natural"="tree"]["species"~"Quercus|quercus|oak|Oak|Eiche|eiche"](around:RADIUS,LAT,LON);node["natural"="tree"]["genus"~"Quercus|quercus"](around:RADIUS,LAT,LON);', [["species", "quercus", "oak", "eiche"], ["genus", "quercus"]]),
    entity("beech", "Buche", "Baumarten", "vegetation", ["buche", "beech", "fagus"], 'node["natural"="tree"]["species"~"Fagus|fagus|beech|Beech|Buche|buche"](around:RADIUS,LAT,LON);node["natural"="tree"]["genus"~"Fagus|fagus"](around:RADIUS,LAT,LON);', [["species", "fagus", "beech", "buche"], ["genus", "fagus"]]),
    entity("birch", "Birke", "Baumarten", "vegetation", ["birke", "birch", "betula"], 'node["natural"="tree"]["species"~"Betula|betula|birch|Birch|Birke|birke"](around:RADIUS,LAT,LON);node["natural"="tree"]["genus"~"Betula|betula"](around:RADIUS,LAT,LON);', [["species", "betula", "birch", "birke"], ["genus", "betula"]]),
    entity("pine", "Kiefer", "Baumarten", "vegetation", ["kiefer", "pine", "pinus"], 'node["natural"="tree"]["species"~"Pinus|pinus|pine|Pine|Kiefer|kiefer"](around:RADIUS,LAT,LON);node["natural"="tree"]["genus"~"Pinus|pinus"](around:RADIUS,LAT,LON);', [["species", "pinus", "pine", "kiefer"], ["genus", "pinus"]]),
    entity("spruce", "Fichte", "Baumarten", "vegetation", ["fichte", "spruce", "picea"], 'node["natural"="tree"]["species"~"Picea|picea|spruce|Spruce|Fichte|fichte"](around:RADIUS,LAT,LON);node["natural"="tree"]["genus"~"Picea|picea"](around:RADIUS,LAT,LON);', [["species", "picea", "spruce", "fichte"], ["genus", "picea"]]),
    entity("maple", "Ahorn", "Baumarten", "vegetation", ["ahorn", "maple", "acer"], 'node["natural"="tree"]["species"~"Acer|acer|maple|Maple|Ahorn|ahorn"](around:RADIUS,LAT,LON);node["natural"="tree"]["genus"~"Acer|acer"](around:RADIUS,LAT,LON);', [["species", "acer", "maple", "ahorn"], ["genus", "acer"]]),
    entity("lime", "Linde", "Baumarten", "vegetation", ["linde", "lime", "tilia"], 'node["natural"="tree"]["species"~"Tilia|tilia|lime|Lime|Linde|linde"](around:RADIUS,LAT,LON);node["natural"="tree"]["genus"~"Tilia|tilia"](around:RADIUS,LAT,LON);', [["species", "tilia", "lime", "linde"], ["genus", "tilia"]]),
    entity("detached", "Einfamilienhaus", "Hausarten", "building", ["einfamilienhaus", "detached", "house"], 'way["building"~"detached|house|semidetached_house"](around:RADIUS,LAT,LON);', [["building", "detached", "house", "semidetached_house"]]),
    entity("apartments", "Mehrfamilienhaus", "Hausarten", "building", ["mehrfamilienhaus", "apartments", "residential"], 'way["building"~"apartments|residential"](around:RADIUS,LAT,LON);', [["building", "apartments", "residential"]]),
    entity("terrace", "Reihenhaus", "Hausarten", "building", ["reihenhaus", "terrace"], 'way["building"~"terrace|house"](around:RADIUS,LAT,LON);', [["building", "terrace"]]),
    entity("half_timbered", "Fachwerk", "Hausarten", "building", ["fachwerk", "half timbered", "timber"], 'way["building"]["building:architecture"~"half-timbered|half_timbered|fachwerk|timber"](around:RADIUS,LAT,LON);way["building"]["facade:material"~"timber|wood"](around:RADIUS,LAT,LON);', [["building:architecture", "half-timbered", "fachwerk", "timber"], ["facade:material", "timber", "wood"]]),
    entity("flat_roof", "Flachdach", "Hausarten", "building", ["flachdach", "flat roof"], 'way["roof:shape"="flat"](around:RADIUS,LAT,LON);', [["roof:shape", "flat"]]),
    entity("gabled_roof", "Satteldach", "Hausarten", "building", ["satteldach", "gabled roof"], 'way["roof:shape"~"gabled|half-hipped"](around:RADIUS,LAT,LON);', [["roof:shape", "gabled", "half-hipped"]]),
    entity("restaurant", "Restaurant", "POIs", "poi", ["restaurant", "essen"], 'node["amenity"="restaurant"](around:RADIUS,LAT,LON);way["amenity"="restaurant"](around:RADIUS,LAT,LON);', [["amenity", "restaurant"]]),
    entity("cafe", "Cafe", "POIs", "poi", ["cafe", "kaffee"], 'node["amenity"="cafe"](around:RADIUS,LAT,LON);way["amenity"="cafe"](around:RADIUS,LAT,LON);', [["amenity", "cafe"]]),
    entity("playground", "Spielplatz", "POIs", "poi", ["spielplatz", "playground"], 'node["leisure"="playground"](around:RADIUS,LAT,LON);way["leisure"="playground"](around:RADIUS,LAT,LON);', [["leisure", "playground"]]),
    entity("school", "Schule", "POIs", "poi", ["schule", "school"], 'node["amenity"="school"](around:RADIUS,LAT,LON);way["amenity"="school"](around:RADIUS,LAT,LON);', [["amenity", "school"]]),
    entity("viewpoint", "Aussichtspunkt", "POIs", "poi", ["aussicht", "viewpoint"], 'node["tourism"="viewpoint"](around:RADIUS,LAT,LON);way["tourism"="viewpoint"](around:RADIUS,LAT,LON);', [["tourism", "viewpoint"]]),
    entity("tower_building", "Hochhaus/Turm", "Landmarks", "building", ["hochhaus", "turm", "skyscraper", "tower", "markantes gebaeude"], 'node["building"~"tower|office|commercial"](around:RADIUS,LAT,LON);way["building"~"tower|office|commercial"](around:RADIUS,LAT,LON);node["man_made"~"tower|mast"](around:RADIUS,LAT,LON);way["man_made"~"tower|mast"](around:RADIUS,LAT,LON);', [["building", "tower", "office", "commercial"], ["man_made", "tower", "mast"], ["height", ""]]),
    entity("jentower", "Jentower", "Landmarks", "building", ["jentower", "jen tower", "jena tower", "intershop tower", "uniturm", "unithochhaus", "streifenturm"], 'node["name"~"JenTower|Jentower|Jena Tower|Intershop Tower|Universitaetshochhaus|Universitätshochhaus"](around:RADIUS,LAT,LON);way["name"~"JenTower|Jentower|Jena Tower|Intershop Tower|Universitaetshochhaus|Universitätshochhaus"](around:RADIUS,LAT,LON);relation["name"~"JenTower|Jentower|Jena Tower|Intershop Tower|Universitaetshochhaus|Universitätshochhaus"](around:RADIUS,LAT,LON);', [["name", "jentower", "jen tower", "jena tower", "intershop tower", "universitaetshochhaus", "universitätshochhaus"], ["building", "tower", "office"]]),
    entity("church_tower", "Kirchturm", "Landmarks", "building", ["kirchturm", "church tower", "stadtkirche", "kirche", "turm"], 'node["amenity"="place_of_worship"](around:RADIUS,LAT,LON);way["amenity"="place_of_worship"](around:RADIUS,LAT,LON);way["building"~"church|cathedral|chapel"](around:RADIUS,LAT,LON);', [["building", "church", "cathedral", "chapel"], ["amenity", "place_of_worship"]]),
    entity("supermarket", "Supermarkt", "POIs", "poi", ["supermarkt", "supermarket"], 'node["shop"="supermarket"](around:RADIUS,LAT,LON);way["shop"="supermarket"](around:RADIUS,LAT,LON);', [["shop", "supermarket"]]),
    entity("pizza", "Pizza", "Kueche", "poi", ["pizza", "italian"], 'node["amenity"~"restaurant|fast_food"]["cuisine"~"pizza|italian"](around:RADIUS,LAT,LON);way["amenity"~"restaurant|fast_food"]["cuisine"~"pizza|italian"](around:RADIUS,LAT,LON);', [["cuisine", "pizza", "italian"]]),
    entity("kebab", "Kebab", "Kueche", "poi", ["kebab", "doener", "doner"], 'node["amenity"~"restaurant|fast_food"]["cuisine"~"kebab|doner|turkish"](around:RADIUS,LAT,LON);way["amenity"~"restaurant|fast_food"]["cuisine"~"kebab|doner|turkish"](around:RADIUS,LAT,LON);', [["cuisine", "kebab", "doner", "turkish"]]),
    entity("sushi", "Sushi", "Kueche", "poi", ["sushi", "japanese"], 'node["amenity"~"restaurant|fast_food"]["cuisine"~"sushi|japanese"](around:RADIUS,LAT,LON);way["amenity"~"restaurant|fast_food"]["cuisine"~"sushi|japanese"](around:RADIUS,LAT,LON);', [["cuisine", "sushi", "japanese"]]),
    entity("forest", "Wald", "Landschaft", "vegetation", ["wald", "forest", "wood"], 'way["landuse"="forest"](around:RADIUS,LAT,LON);way["natural"="wood"](around:RADIUS,LAT,LON);relation["landuse"="forest"](around:RADIUS,LAT,LON);', [["landuse", "forest"], ["natural", "wood"]]),
    entity("meadow", "Wiese", "Landschaft", "vegetation", ["wiese", "meadow", "grass"], 'way["landuse"~"meadow|grass|recreation_ground"](around:RADIUS,LAT,LON);way["natural"="grassland"](around:RADIUS,LAT,LON);', [["landuse", "meadow", "grass", "recreation_ground"], ["natural", "grassland"]]),
    entity("river", "Wasserlauf", "Landschaft", "water", ["wasser", "fluss", "bach", "river", "stream"], 'way["waterway"~"river|stream|canal"](around:RADIUS,LAT,LON);node["waterway"~"river|stream|canal"](around:RADIUS,LAT,LON);', [["waterway", "river", "stream", "canal"]]),
    entity("bridge", "Bruecke", "Landschaft", "transport", ["bruecke", "bridge"], 'way["bridge"](around:RADIUS,LAT,LON);node["bridge"](around:RADIUS,LAT,LON);', [["bridge", "yes"]]),
    entity("bus_stop", "Bushaltestelle", "Verkehr", "transport", ["bus", "haltestelle", "bus_stop"], 'node["highway"="bus_stop"](around:RADIUS,LAT,LON);node["public_transport"="platform"](around:RADIUS,LAT,LON);', [["highway", "bus_stop"], ["public_transport", "platform"]]),
    entity("power_pole", "Strommast", "Energie", "transport", ["strommast", "strommasten", "power pole", "utility pole"], 'node["power"~"pole|tower"](around:RADIUS,LAT,LON);', [["power", "pole", "tower"]]),
    entity("power_line", "Stromleitung", "Energie", "transport", ["stromleitung", "hochspannung", "power line"], 'way["power"~"line|minor_line"](around:RADIUS,LAT,LON);', [["power", "line", "minor_line"]]),
    entity("substation", "Umspannwerk", "Energie", "transport", ["umspannwerk", "substation", "transformator"], 'node["power"~"substation|transformer"](around:RADIUS,LAT,LON);way["power"~"substation|transformer"](around:RADIUS,LAT,LON);', [["power", "substation", "transformer"]]),
    entity("wind_turbine", "Windrad", "Energie", "transport", ["windrad", "wind turbine"], 'node["power"="generator"]["generator:source"="wind"](around:RADIUS,LAT,LON);way["power"="generator"]["generator:source"="wind"](around:RADIUS,LAT,LON);', [["power", "generator"], ["generator:source", "wind"]]),
    entity("solar", "Solaranlage", "Energie", "transport", ["solar", "solaranlage", "photovoltaik"], 'node["power"="generator"]["generator:source"="solar"](around:RADIUS,LAT,LON);way["power"="generator"]["generator:source"="solar"](around:RADIUS,LAT,LON);', [["power", "generator"], ["generator:source", "solar"]]),
    entity("telecom_mast", "Funkmast", "Infrastruktur", "transport", ["funkmast", "sendemast", "telecom mast"], 'node["man_made"~"mast|tower"]["communication:mobile_phone"](around:RADIUS,LAT,LON);node["man_made"~"mast|tower"]["tower:type"~"communication|telecommunication"](around:RADIUS,LAT,LON);', [["man_made", "mast", "tower"], ["tower:type", "communication", "telecommunication"]]),
    entity("street_lamp", "Strassenlaterne", "Infrastruktur", "transport", ["laterne", "strassenlaterne", "street lamp"], 'node["highway"="street_lamp"](around:RADIUS,LAT,LON);node["amenity"="street_lamp"](around:RADIUS,LAT,LON);', [["highway", "street_lamp"], ["amenity", "street_lamp"]]),
    entity("camera", "Ueberwachungskamera", "Infrastruktur", "poi", ["kamera", "ueberwachung", "surveillance"], 'node["man_made"="surveillance"](around:RADIUS,LAT,LON);node["surveillance"](around:RADIUS,LAT,LON);', [["man_made", "surveillance"], ["surveillance", "yes", "camera"]]),
    entity("fire_hydrant", "Hydrant", "Infrastruktur", "poi", ["hydrant", "feuerwehrhydrant"], 'node["emergency"="fire_hydrant"](around:RADIUS,LAT,LON);', [["emergency", "fire_hydrant"]]),
    entity("post_box", "Briefkasten", "Stadtmoebel", "poi", ["briefkasten", "postbox", "post box"], 'node["amenity"="post_box"](around:RADIUS,LAT,LON);', [["amenity", "post_box"]]),
    entity("bench", "Bank", "Stadtmoebel", "poi", ["bank", "sitzbank", "bench"], 'node["amenity"="bench"](around:RADIUS,LAT,LON);', [["amenity", "bench"]]),
    entity("waste_basket", "Muelleimer", "Stadtmoebel", "poi", ["muelleimer", "mülleimer", "waste basket"], 'node["amenity"="waste_basket"](around:RADIUS,LAT,LON);', [["amenity", "waste_basket"]]),
    entity("bollard", "Poller", "Stadtmoebel", "transport", ["poller", "bollard"], 'node["barrier"="bollard"](around:RADIUS,LAT,LON);way["barrier"="bollard"](around:RADIUS,LAT,LON);', [["barrier", "bollard"]]),
    entity("street_cabinet", "Verteilerkasten", "Stadtmoebel", "transport", ["verteilerkasten", "street cabinet", "stromkasten"], 'node["man_made"="street_cabinet"](around:RADIUS,LAT,LON);node["street_cabinet"](around:RADIUS,LAT,LON);', [["man_made", "street_cabinet"], ["street_cabinet", "power", "telecom", "traffic_control"]]),
    entity("traffic_sign", "Verkehrsschild", "Schilder", "transport", ["verkehrsschild", "schild", "traffic sign"], 'node["traffic_sign"](around:RADIUS,LAT,LON);way["traffic_sign"](around:RADIUS,LAT,LON);way["traffic_sign:forward"](around:RADIUS,LAT,LON);way["traffic_sign:backward"](around:RADIUS,LAT,LON);', [["traffic_sign", ""], ["traffic_sign:forward", ""], ["traffic_sign:backward", ""]]),
    entity("stop_sign", "Stoppschild", "Schilder", "transport", ["stoppschild", "stop sign"], 'node["highway"="stop"](around:RADIUS,LAT,LON);node["traffic_sign"~"stop|STOP|206|R1-1"](around:RADIUS,LAT,LON);', [["highway", "stop"], ["traffic_sign", "stop", "206", "R1-1"]]),
    entity("give_way", "Vorfahrt gewaehrten", "Schilder", "transport", ["vorfahrt gewaehren", "yield", "give way"], 'node["highway"="give_way"](around:RADIUS,LAT,LON);node["traffic_sign"~"give_way|yield|205|R1-2"](around:RADIUS,LAT,LON);', [["highway", "give_way"], ["traffic_sign", "give_way", "yield", "205", "R1-2"]]),
    entity("speed_limit", "Tempolimit", "Schilder", "transport", ["tempolimit", "maxspeed", "speed limit"], 'node["traffic_sign"~"274|speed|Speed|maxspeed|R2"](around:RADIUS,LAT,LON);way["maxspeed"](around:RADIUS,LAT,LON);', [["traffic_sign", "274", "speed", "R2"], ["maxspeed", ""]]),
    entity("city_limit_sign", "Ortsschild", "Schilder", "transport", ["ortsschild", "city limit"], 'node["traffic_sign"~"city_limit|310|311"](around:RADIUS,LAT,LON);way["traffic_sign"~"city_limit|310|311"](around:RADIUS,LAT,LON);', [["traffic_sign", "city_limit", "310", "311"]]),
    entity("no_entry", "Einfahrt verboten", "Schilder", "transport", ["einfahrt verboten", "no entry"], 'node["traffic_sign"~"no_entry|267|R5-1"](around:RADIUS,LAT,LON);way["oneway"="yes"](around:RADIUS,LAT,LON);', [["traffic_sign", "no_entry", "267", "R5-1"], ["oneway", "yes"]]),
    entity("roundabout", "Kreisverkehr", "Schilder", "transport", ["kreisverkehr", "roundabout"], 'node["traffic_sign"~"roundabout|215"](around:RADIUS,LAT,LON);way["junction"="roundabout"](around:RADIUS,LAT,LON);', [["traffic_sign", "roundabout", "215"], ["junction", "roundabout"]]),
    entity("pedestrian_crossing_sign", "Fussgaengerueberweg-Schild", "Schilder", "transport", ["fussgaengerueberweg", "fußgängerüberweg", "pedestrian crossing sign"], 'node["traffic_sign"~"350|pedestrian|crossing"](around:RADIUS,LAT,LON);node["highway"="crossing"](around:RADIUS,LAT,LON);', [["traffic_sign", "350", "pedestrian", "crossing"], ["highway", "crossing"]]),
    entity("rail_crossing_sign", "Bahnuebergang", "Schilder", "transport", ["bahnuebergang", "railway crossing"], 'node["railway"="level_crossing"](around:RADIUS,LAT,LON);node["traffic_sign"~"railway|level_crossing|201"](around:RADIUS,LAT,LON);', [["railway", "level_crossing"], ["traffic_sign", "railway", "level_crossing", "201"]]),
    entity("road_marking", "Strassenmarkierung", "Strassenmarkierung", "transport", ["strassenmarkierung", "straßenmarkierung", "road marking"], 'node["road_marking"](around:RADIUS,LAT,LON);way["road_marking"](around:RADIUS,LAT,LON);', [["road_marking", ""]]),
    entity("zebra_crossing", "Zebrastreifen", "Strassenmarkierung", "transport", ["zebrastreifen", "zebra crossing"], 'node["highway"="crossing"]["crossing:markings"~"zebra|lines|ladder"](around:RADIUS,LAT,LON);node["highway"="crossing"]["crossing"~"zebra|marked"](around:RADIUS,LAT,LON);', [["highway", "crossing"], ["crossing:markings", "zebra", "lines", "ladder"], ["crossing", "zebra", "marked"]]),
    entity("stop_line", "Haltelinie", "Strassenmarkierung", "transport", ["haltelinie", "stop line"], 'node["road_marking"~"stop_line|stop"](around:RADIUS,LAT,LON);way["road_marking"~"stop_line|stop"](around:RADIUS,LAT,LON);node["highway"="stop"](around:RADIUS,LAT,LON);', [["road_marking", "stop_line", "stop"], ["highway", "stop"]]),
    entity("lane_arrows", "Spurpfeile", "Strassenmarkierung", "transport", ["spurpfeile", "lane arrows", "turn lanes"], 'way["turn:lanes"](around:RADIUS,LAT,LON);way["turn:lanes:forward"](around:RADIUS,LAT,LON);way["turn:lanes:backward"](around:RADIUS,LAT,LON);', [["turn:lanes", ""], ["turn:lanes:forward", ""], ["turn:lanes:backward", ""]]),
    entity("cycle_lane", "Radfahrstreifen", "Strassenmarkierung", "transport", ["radfahrstreifen", "bike lane", "cycle lane"], 'way["cycleway"="lane"](around:RADIUS,LAT,LON);way["cycleway:left"="lane"](around:RADIUS,LAT,LON);way["cycleway:right"="lane"](around:RADIUS,LAT,LON);', [["cycleway", "lane"], ["cycleway:left", "lane"], ["cycleway:right", "lane"]]),
    entity("bus_lane", "Busspur", "Strassenmarkierung", "transport", ["busspur", "bus lane"], 'way["bus:lanes"](around:RADIUS,LAT,LON);way["busway"](around:RADIUS,LAT,LON);way["psv:lanes"](around:RADIUS,LAT,LON);', [["bus:lanes", ""], ["busway", ""], ["psv:lanes", ""]]),
    entity("traffic_calming", "Verkehrsberuhigung", "Strasse", "transport", ["verkehrsberuhigung", "speed bump", "traffic calming"], 'node["traffic_calming"](around:RADIUS,LAT,LON);way["traffic_calming"](around:RADIUS,LAT,LON);', [["traffic_calming", ""]]),
    entity("speed_camera", "Blitzer", "Strasse", "transport", ["blitzer", "speed camera"], 'node["highway"="speed_camera"](around:RADIUS,LAT,LON);node["enforcement"="maxspeed"](around:RADIUS,LAT,LON);', [["highway", "speed_camera"], ["enforcement", "maxspeed"]]),
    entity("traffic_signal", "Ampel", "Strasse", "transport", ["ampel", "traffic signal"], 'node["highway"="traffic_signals"](around:RADIUS,LAT,LON);', [["highway", "traffic_signals"]]),
    entity("milestone", "Kilometerstein", "GeoGuessr-Hinweise", "transport", ["kilometerstein", "milestone"], 'node["highway"="milestone"](around:RADIUS,LAT,LON);node["historic"="milestone"](around:RADIUS,LAT,LON);', [["highway", "milestone"], ["historic", "milestone"]]),
    entity("guidepost", "Wegweiser", "GeoGuessr-Hinweise", "transport", ["wegweiser", "guidepost", "signpost"], 'node["information"="guidepost"](around:RADIUS,LAT,LON);node["tourism"="information"]["information"="guidepost"](around:RADIUS,LAT,LON);', [["information", "guidepost"], ["tourism", "information"]]),
    entity("road_reference", "Strassennummer", "GeoGuessr-Hinweise", "transport", ["strassennummer", "road ref", "route number"], 'way["ref"](around:RADIUS,LAT,LON);relation["route"="road"]["ref"](around:RADIUS,LAT,LON);', [["ref", ""], ["route", "road"]]),
    entity("surface_unpaved", "Unbefestigte Strasse", "GeoGuessr-Hinweise", "transport", ["schotter", "unpaved", "gravel road"], 'way["surface"~"unpaved|gravel|dirt|ground|compacted"](around:RADIUS,LAT,LON);', [["surface", "unpaved", "gravel", "dirt", "ground", "compacted"]]),
    entity("alley", "Altstadtgasse", "GeoGuessr-Hinweise", "transport", ["gasse", "altstadtgasse", "enge gasse", "schmale gasse", "old town alley"], 'way["highway"~"pedestrian|living_street|service|footway"]["name"~"Gasse|gasse|Wagnergasse|Johannisgasse|Jenergasse"](around:RADIUS,LAT,LON);way["highway"~"pedestrian|living_street|service|footway"]["surface"~"sett|cobblestone|paving_stones"](around:RADIUS,LAT,LON);', [["highway", "pedestrian", "living_street", "service", "footway"], ["name", "gasse", "wagnergasse", "johannisgasse", "jenergasse"]]),
    entity("cobblestone", "Kopfsteinpflaster", "GeoGuessr-Hinweise", "transport", ["kopfsteinpflaster", "pflastersteine", "cobblestone", "sett", "paving stones"], 'way["surface"~"sett|cobblestone|paving_stones"](around:RADIUS,LAT,LON);', [["surface", "sett", "cobblestone", "paving_stones"]]),
    entity("outdoor_seating", "Aussengastronomie", "GeoGuessr-Hinweise", "poi", ["aussengastronomie", "outdoor seating", "strassencafe", "street cafe", "tische draussen"], 'node["amenity"~"restaurant|cafe|bar|pub"]["outdoor_seating"~"yes|seasonal"](around:RADIUS,LAT,LON);way["amenity"~"restaurant|cafe|bar|pub"]["outdoor_seating"~"yes|seasonal"](around:RADIUS,LAT,LON);', [["outdoor_seating", "yes", "seasonal"], ["amenity", "restaurant", "cafe", "bar", "pub"]]),
    ...countrySignEntities(),
];

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));

function init() {
    state.view = new ol.View({
        center: ol.proj.fromLonLat([state.center[1], state.center[0]]),
        zoom: state.searchCenterReady ? 14 : 2,
        maxZoom: 20,
    });
    state.baseLayer = new ol.layer.Tile({
        source: createTileSource("voyager"),
        preload: 2,
    });
    state.searchSource = new ol.source.Vector();
    state.resultSource = new ol.source.Vector();
    state.imageSource = new ol.source.Vector();
    state.popupElement = createPopupElement();
    state.popupOverlay = new ol.Overlay({
        element: state.popupElement,
        positioning: "bottom-center",
        stopEvent: true,
        offset: [0, -18],
    });
    state.map = new ol.Map({
        target: "map",
        layers: [
            state.baseLayer,
            new ol.layer.Vector({ source: state.searchSource, style: searchRadiusStyle() }),
            new ol.layer.Vector({ source: state.resultSource, style: resultFeatureStyle }),
            new ol.layer.Vector({ source: state.imageSource, style: imageFeatureStyle() }),
        ],
        overlays: [state.popupOverlay],
        controls: ol.control.defaults.defaults({ zoom: false, rotate: false }).extend([
            new ol.control.Zoom({ className: "ol-zoom gvis-zoom" }),
        ]),
        interactions: ol.interaction.defaults.defaults({ mouseWheelZoom: false, altShiftDragRotate: false, pinchRotate: false }),
        view: state.view,
    });
    state.map.on("singleclick", handleMapClick);
    drawSearchCircle();
    renderEntityCatalog();
    renderSelectedEntities();
    bindUi();
    window.addEventListener("resize", () => state.map.updateSize());
    if ("ResizeObserver" in window) {
        new ResizeObserver(() => state.map.updateSize()).observe($("#map"));
    }
    [0, 120, 350, 800].forEach((delay) => setTimeout(() => state.map.updateSize(), delay));
}

function createTileSource(key) {
    const config = basemapConfigs[key] || basemapConfigs.voyager;
    return new ol.source.XYZ({
        urls: config.urls,
        attributions: config.attribution,
        maxZoom: 20,
        transition: 0,
    });
}

function createPopupElement() {
    const popup = document.createElement("div");
    popup.className = "gvis-popup";
    popup.hidden = true;
    return popup;
}

function searchRadiusStyle() {
    return new ol.style.Style({
        fill: new ol.style.Fill({ color: "rgba(96, 165, 250, 0.12)" }),
        stroke: new ol.style.Stroke({ color: "#2563eb", width: 2 }),
    });
}

function resultFeatureStyle(feature) {
    const result = feature.get("result");
    const score = result?.score || 0;
    const size = Math.max(7, Math.round(7 + score / 8));
    const color = score >= 70 ? "#16a34a" : score >= 42 ? "#f59e0b" : "#e11d48";
    return new ol.style.Style({
        image: new ol.style.Circle({
            radius: size,
            fill: new ol.style.Fill({ color }),
            stroke: new ol.style.Stroke({ color: "#ffffff", width: 2 }),
        }),
    });
}

function imageFeatureStyle() {
    return new ol.style.Style({
        image: new ol.style.Circle({
            radius: 9,
            fill: new ol.style.Fill({ color: "#2563eb" }),
            stroke: new ol.style.Stroke({ color: "#ffffff", width: 3 }),
        }),
    });
}

function handleMapClick(event) {
    const feature = state.map.forEachFeatureAtPixel(event.pixel, (candidate) => candidate);
    if (!feature) {
        hidePopup();
        return;
    }
    const html = feature.get("popupHtml");
    if (html) openFeaturePopup(feature, html);
}

function bindUi() {
    $("#runBtn").addEventListener("click", runAnalysis);
    $("#clearBtn").addEventListener("click", clearMap);
    $("#searchPlaceBtn").addEventListener("click", searchPlace);
    $("#locateBtn").addEventListener("click", locateUser);
    $("#radiusSelect").addEventListener("change", drawSearchCircle);
    $("#fileInput").addEventListener("change", importFile);
    $("#imageInput").addEventListener("change", analyzeImageFile);
    $("#resolveImageTextBtn").addEventListener("click", resolveManualImageText);
    $("#reviewInput").addEventListener("change", importReviewFile);
    $("#entitySearch").addEventListener("input", renderEntityCatalog);
    $("#clearEntitiesBtn").addEventListener("click", clearEntitySelection);
    $("#addCustomEntityBtn").addEventListener("click", addCustomEntity);
    $("#applyImageHintsBtn").addEventListener("click", applyImageHintsToQuery);
    $("#basemapSelect").addEventListener("change", switchBasemap);
    $("#exportBtn").addEventListener("click", exportGeoJson);
    ["poiWeight", "contextWeight", "densityWeight"].forEach((id) => {
        const input = $(`#${id}`);
        input.addEventListener("input", () => {
            $(`#${id}Value`).textContent = input.value;
        });
    });
    $$(".chip-btn").forEach((button) => {
        button.addEventListener("click", () => {
            $("#queryInput").value = button.dataset.query;
        });
    });
    $("#placeInput").addEventListener("keydown", (event) => {
        if (event.key === "Enter") searchPlace();
    });
    $("#imageTextInput").addEventListener("keydown", (event) => {
        if (event.key === "Enter") resolveManualImageText();
    });
}

function switchBasemap(event) {
    state.baseLayer.setSource(createTileSource(event.target.value));
}

function selectedSources() {
    return $$(".source-check:checked").map((input) => input.value);
}

function entity(id, label, category, group, terms, query, matchers) {
    return {
        id,
        label,
        category,
        group,
        terms,
        query,
        matchers: matchers.map(([key, ...values]) => ({ key, values })),
    };
}

function focusRule(id, label, terms, query) {
    return { id, label, terms, query };
}

function countrySignEntities() {
    return countrySignDefinitions.map(([code, label, terms]) => {
        return entity(`traffic_sign_${code.toLowerCase()}`, `${label}-Schilder`, "Schilder nach Laendern", "transport", [...terms, `${code}:`, "traffic sign", "verkehrsschild"], countrySignQuery(code), [
            ["traffic_sign", `${code}:`],
            ["traffic_sign:forward", `${code}:`],
            ["traffic_sign:backward", `${code}:`],
        ]);
    });
}

function countrySignQuery(code) {
    return `node["traffic_sign"~"${code}:"](around:RADIUS,LAT,LON);way["traffic_sign"~"${code}:"](around:RADIUS,LAT,LON);way["traffic_sign:forward"~"${code}:"](around:RADIUS,LAT,LON);way["traffic_sign:backward"~"${code}:"](around:RADIUS,LAT,LON);`;
}

function focusedCountrySignPlans(query) {
    if (!query.raw.includes("schild") && !query.raw.includes("sign")) return [];
    return countrySignDefinitions
        .filter(([code, , terms]) => query.raw.includes(normalize(code)) || terms.some((term) => query.raw.includes(normalize(term))))
        .map(([code, label]) => ({ id: `country-sign-${code}`, label: `${label}-Schilder`, query: countrySignQuery(code) }));
}

function allEntityObjects() {
    return [...entityCatalog, ...state.dynamicEntities];
}

function selectedEntityObjects() {
    return allEntityObjects().filter((item) => state.selectedEntities.has(item.id));
}

function renderEntityCatalog() {
    const catalog = $("#entityCatalog");
    if (!catalog) return;
    const filter = normalize($("#entitySearch")?.value || "");
    const visible = allEntityObjects().filter((item) => {
        const haystack = normalize([item.label, item.category, item.group, ...item.terms].join(" "));
        return !filter || haystack.includes(filter);
    });
    catalog.innerHTML = "";
    const groups = [...new Set(visible.map((item) => item.category))];
    groups.forEach((group) => {
        const wrapper = document.createElement("div");
        wrapper.className = "entity-group";
        const title = document.createElement("div");
        title.className = "entity-group-title";
        title.textContent = group;
        wrapper.appendChild(title);
        visible.filter((item) => item.category === group).forEach((item) => {
            const button = document.createElement("button");
            button.type = "button";
            button.className = `entity-chip${state.selectedEntities.has(item.id) ? " active" : ""}`;
            button.textContent = item.label;
            if (item.dynamic) {
                button.title = `${item.count || 1} gemessene Treffer`;
                if (item.count) button.dataset.count = String(item.count);
            }
            button.addEventListener("click", () => toggleEntity(item.id));
            wrapper.appendChild(button);
        });
        catalog.appendChild(wrapper);
    });
}

function renderSelectedEntities() {
    const box = $("#selectedEntities");
    if (!box) return;
    box.innerHTML = "";
    selectedEntityObjects().forEach((item) => {
        const chip = document.createElement("button");
        chip.type = "button";
        chip.className = "selected-chip";
        chip.textContent = item.label;
        chip.title = "Entitaet entfernen";
        chip.addEventListener("click", () => toggleEntity(item.id));
        box.appendChild(chip);
    });
}

function toggleEntity(id) {
    if (state.selectedEntities.has(id)) {
        state.selectedEntities.delete(id);
    } else {
        state.selectedEntities.add(id);
    }
    syncEntityQueryText();
    renderEntityCatalog();
    renderSelectedEntities();
}

function clearEntitySelection() {
    state.selectedEntities.clear();
    syncEntityQueryText();
    renderEntityCatalog();
    renderSelectedEntities();
}

function addCustomEntity() {
    const keyInput = $("#customKeyInput");
    const valueInput = $("#customValueInput");
    const key = keyInput.value.trim();
    const value = valueInput.value.trim();
    if (!key) {
        setStatus("OSM-Key fehlt.");
        return;
    }
    const id = `custom-${Date.now()}`;
    const label = value ? `${key}=${value}` : key;
    const keyText = overpassString(key);
    const valueText = overpassString(value);
    const query = value
        ? `node["${keyText}"~"${valueText}"](around:RADIUS,LAT,LON);way["${keyText}"~"${valueText}"](around:RADIUS,LAT,LON);relation["${keyText}"~"${valueText}"](around:RADIUS,LAT,LON);`
        : `node["${keyText}"](around:RADIUS,LAT,LON);way["${keyText}"](around:RADIUS,LAT,LON);relation["${keyText}"](around:RADIUS,LAT,LON);`;
    entityCatalog.push(entity(id, label, "Eigene", inferGroupFromKey(key), [key, value, label].filter(Boolean), query, [[key, value]]));
    state.selectedEntities.add(id);
    keyInput.value = "";
    valueInput.value = "";
    syncEntityQueryText();
    renderEntityCatalog();
    renderSelectedEntities();
    setStatus(`Eigene Entitaet ${label} hinzugefuegt.`);
}

function refreshDynamicEntities(features = [], options = {}) {
    const pool = [...state.measuredFeaturePool, ...features].filter(Boolean);
    state.measuredFeaturePool = dedupeMeasuredFeatures(pool).slice(0, 900);
    const previousSelected = new Set(state.selectedEntities);
    state.dynamicEntities = buildDynamicEntities(state.measuredFeaturePool);
    previousSelected.forEach((id) => {
        if (!allEntityObjects().some((item) => item.id === id)) state.selectedEntities.delete(id);
    });
    renderEntityCatalog();
    renderSelectedEntities();
    if (options.status && state.dynamicEntities.length) {
        setStatus(`${state.dynamicEntities.length} dynamische Entitaeten aus messbaren Daten gelesen.`);
    }
}

function dedupeMeasuredFeatures(features) {
    const seen = new Set();
    return features.filter((feature) => {
        if (!feature) return false;
        const key = feature.id || `${feature.source || "feature"}:${feature.lat}:${feature.lon}:${feature.name || ""}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

function buildDynamicEntities(features) {
    const buckets = new Map();
    features.forEach((feature) => dynamicEntityMeasurements(feature).forEach((measurement) => {
        const key = dynamicEntityKey(measurement.key, measurement.value);
        const current = buckets.get(key) || {
            ...measurement,
            count: 0,
            examples: new Set(),
        };
        current.count += 1;
        if (feature.name) current.examples.add(feature.name);
        buckets.set(key, current);
    }));
    return Array.from(buckets.values())
        .filter((item) => item.count >= item.minCount && !baseEntityCoversMeasurement(item.key, item.value))
        .sort((a, b) => dynamicEntityPriority(b) - dynamicEntityPriority(a))
        .slice(0, 80)
        .map(dynamicMeasurementToEntity);
}

function baseEntityCoversMeasurement(key, value) {
    const expected = normalize(value);
    return entityCatalog.some((item) => item.matchers.some((matcher) => {
        if (matcher.key !== key) return false;
        return matcher.values.filter(Boolean).some((candidate) => expected.includes(normalize(candidate)) || normalize(candidate).includes(expected));
    }));
}

function dynamicEntityMeasurements(feature) {
    const tags = feature.tags || {};
    const measurements = [];
    measurableTagRules().forEach((rule) => {
        const raw = tags[rule.key];
        if (!raw) return;
        String(raw).split(";").map((part) => part.trim()).filter(Boolean).forEach((value) => {
            if (!isUsefulDynamicValue(rule.key, value)) return;
            measurements.push({
                key: rule.key,
                value,
                label: dynamicEntityLabel(rule, value),
                category: rule.category,
                group: rule.group,
                minCount: rule.minCount || 1,
                weight: rule.weight || 1,
            });
        });
    });
    if (tags.name && (tags.wikidata || tags.wikipedia || tags.tourism || tags.historic || tags.memorial || tags.artwork_type)) {
        measurements.push({
            key: "name",
            value: tags.name,
            label: `Name: ${tags.name}`,
            category: "Gemessen: Landmarken",
            group: "poi",
            minCount: 1,
            weight: 5,
        });
    }
    return measurements;
}

function measurableTagRules() {
    return [
        { key: "tourism", category: "Gemessen: Sehenswuerdigkeiten", group: "poi", weight: 5 },
        { key: "historic", category: "Gemessen: Historisch", group: "poi", weight: 5 },
        { key: "memorial", category: "Gemessen: Historisch", group: "poi", weight: 4 },
        { key: "artwork_type", category: "Gemessen: Kunst", group: "poi", weight: 4 },
        { key: "amenity", category: "Gemessen: POIs", group: "poi", minCount: 2, weight: 3 },
        { key: "shop", category: "Gemessen: Shops", group: "poi", minCount: 2, weight: 3 },
        { key: "cuisine", category: "Gemessen: Kueche", group: "poi", weight: 3 },
        { key: "building", category: "Gemessen: Bauform", group: "building", minCount: 2, weight: 2 },
        { key: "building:architecture", category: "Gemessen: Bauform", group: "building", weight: 4 },
        { key: "roof:shape", category: "Gemessen: Dachform", group: "building", weight: 3 },
        { key: "facade:material", category: "Gemessen: Fassade", group: "building", weight: 3 },
        { key: "material", category: "Gemessen: Material", group: "building", minCount: 2, weight: 2 },
        { key: "natural", category: "Gemessen: Landschaft", group: "vegetation", weight: 3 },
        { key: "landuse", category: "Gemessen: Landschaft", group: "vegetation", minCount: 2, weight: 2 },
        { key: "leisure", category: "Gemessen: Freizeit", group: "vegetation", weight: 3 },
        { key: "species", category: "Gemessen: Baumarten", group: "vegetation", weight: 5 },
        { key: "genus", category: "Gemessen: Baumarten", group: "vegetation", weight: 4 },
        { key: "highway", category: "Gemessen: Verkehr", group: "transport", minCount: 2, weight: 2 },
        { key: "surface", category: "Gemessen: Oberflaeche", group: "transport", minCount: 2, weight: 3 },
        { key: "traffic_sign", category: "Gemessen: Schilder", group: "transport", weight: 4 },
        { key: "traffic_sign:forward", category: "Gemessen: Schilder", group: "transport", weight: 4 },
        { key: "traffic_sign:backward", category: "Gemessen: Schilder", group: "transport", weight: 4 },
        { key: "road_marking", category: "Gemessen: Strassenmarkierung", group: "transport", weight: 4 },
        { key: "power", category: "Gemessen: Infrastruktur", group: "transport", weight: 3 },
        { key: "man_made", category: "Gemessen: Infrastruktur", group: "transport", weight: 3 },
        { key: "waterway", category: "Gemessen: Wasser", group: "water", weight: 3 },
        { key: "water", category: "Gemessen: Wasser", group: "water", weight: 3 },
        { key: "wikidata", category: "Gemessen: Landmarken", group: "poi", weight: 5 },
        { key: "wikipedia", category: "Gemessen: Landmarken", group: "poi", weight: 5 },
    ];
}

function isUsefulDynamicValue(key, value) {
    const text = normalize(value);
    if (!text || text === "yes" || text === "no" || text === "unknown") return false;
    if (text.length > 80) return false;
    if (["building", "landuse", "highway", "amenity", "shop", "tourism", "historic"].includes(key) && text === "yes") return false;
    return true;
}

function dynamicEntityLabel(rule, value) {
    const label = readableDynamicValue(rule.key, value);
    return label.includes("=") ? label : `${readableDynamicKey(rule.key)}: ${label}`;
}

function readableDynamicKey(key) {
    return ({
        "building:architecture": "Architektur",
        "roof:shape": "Dach",
        "facade:material": "Fassade",
        "traffic_sign:forward": "Schild vorwaerts",
        "traffic_sign:backward": "Schild rueckwaerts",
        artwork_type: "Kunst",
        man_made: "Infrastruktur",
        wikidata: "Wikidata",
        wikipedia: "Wikipedia",
    }[key] || key);
}

function readableDynamicValue(key, value) {
    const raw = String(value || "");
    if (key === "wikidata" || key === "wikipedia") return raw;
    return raw
        .replace(/_/g, " ")
        .replace(/\b\w/g, (char) => char.toUpperCase())
        .slice(0, 64);
}

function dynamicEntityPriority(item) {
    return item.weight * 10 + item.count + (item.key === "name" ? 20 : 0);
}

function dynamicMeasurementToEntity(item) {
    const keyText = overpassString(item.key);
    const valueText = overpassString(item.value);
    const id = dynamicEntityKey(item.key, item.value);
    const query = item.key === "name"
        ? `node["name"~"${valueText}"](around:RADIUS,LAT,LON);way["name"~"${valueText}"](around:RADIUS,LAT,LON);relation["name"~"${valueText}"](around:RADIUS,LAT,LON);`
        : `node["${keyText}"~"${valueText}"](around:RADIUS,LAT,LON);way["${keyText}"~"${valueText}"](around:RADIUS,LAT,LON);relation["${keyText}"~"${valueText}"](around:RADIUS,LAT,LON);`;
    return {
        ...entity(id, `${item.label} (${item.count})`, item.category, item.group, [item.key, item.value, item.label, ...Array.from(item.examples).slice(0, 3)], query, [[item.key, item.value]]),
        dynamic: true,
        count: item.count,
    };
}

function dynamicEntityKey(key, value) {
    return `dyn-${normalize(`${key}-${value}`).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80)}`;
}

function overpassString(value) {
    return String(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function inferGroupFromKey(key) {
    if (["building", "roof:shape", "building:architecture", "facade:material"].includes(key)) return "building";
    if (["natural", "landuse", "leisure", "species", "genus", "taxon"].includes(key)) return "vegetation";
    if (["water", "waterway", "bridge"].includes(key)) return "water";
    if (["highway", "railway", "public_transport"].includes(key)) return "transport";
    return "poi";
}

function syncEntityQueryText() {
    const input = $("#queryInput");
    const selectedLabels = selectedEntityObjects().map((item) => item.label);
    const base = input.value.replace(/\n?Entitaeten:.*$/s, "").trim();
    input.value = selectedLabels.length ? `${base}${base ? "\n" : ""}Entitaeten: ${selectedLabels.join(", ")}` : base;
}

function setStatus(message) {
    $("#statusText").textContent = message;
}

function radius() {
    return Number($("#radiusSelect").value);
}

function setMapView(center, zoom) {
    if (!state.view) return;
    state.view.animate({
        center: ol.proj.fromLonLat([center[1], center[0]]),
        zoom,
        duration: 450,
    });
}

function drawSearchCircle() {
    if (!state.searchSource) return;
    state.searchSource.clear();
    if (!state.searchCenterReady) return;
    const center = ol.proj.fromLonLat([state.center[1], state.center[0]]);
    const feature = new ol.Feature(new ol.geom.Circle(center, radius()));
    state.searchSource.addFeature(feature);
}

function setSearchCenter(center, zoom, status) {
    state.center = center;
    state.searchCenterReady = true;
    state.measuredFeaturePool = [...state.importedFeatures];
    state.dynamicEntities = buildDynamicEntities(state.measuredFeaturePool);
    state.selectedEntities.forEach((id) => {
        if (!allEntityObjects().some((item) => item.id === id)) state.selectedEntities.delete(id);
    });
    renderEntityCatalog();
    renderSelectedEntities();
    setMapView(state.center, zoom);
    drawSearchCircle();
    if (status) setStatus(status);
}

async function searchPlace() {
    const raw = $("#placeInput").value.trim();
    if (!raw) return;
    const coordinateMatch = raw.match(/^\s*(-?\d+(?:\.\d+)?)\s*[,;]\s*(-?\d+(?:\.\d+)?)\s*$/);
    if (coordinateMatch) {
        setSearchCenter([Number(coordinateMatch[1]), Number(coordinateMatch[2])], 14, "Koordinaten gesetzt.");
        return;
    }
    setStatus("Ort wird gesucht ...");
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(raw)}`;
    try {
        const response = await fetch(url, { headers: { "Accept": "application/json" } });
        const places = await response.json();
        if (!places.length) {
            setStatus("Ort nicht gefunden.");
            return;
        }
        setSearchCenter([Number(places[0].lat), Number(places[0].lon)], 14, `Suchraum gesetzt: ${places[0].display_name}`);
    } catch (error) {
        setStatus(`Ortssuche fehlgeschlagen: ${error.message}`);
    }
}

function locateUser() {
    if (!navigator.geolocation) {
        setStatus("Geolocation ist in diesem Browser nicht verfuegbar.");
        return;
    }
    setStatus("Standort wird abgefragt ...");
    navigator.geolocation.getCurrentPosition((position) => {
        setSearchCenter([position.coords.latitude, position.coords.longitude], 15, "Suchraum auf aktuellen Standort gesetzt.");
    }, () => setStatus("Standort konnte nicht ermittelt werden."));
}

async function runAnalysis() {
    if (state.loading) return;
    const sources = selectedSources();
    if (!sources.length && !state.importedFeatures.length && !state.selectedEntities.size) {
        setStatus("Mindestens eine Datenquelle, Entitaet oder Datei auswaehlen.");
        return;
    }
    if (!state.searchCenterReady && (sources.length || state.selectedEntities.size)) {
        setStatus("Erst Suchraum setzen: Ort/Koordinaten suchen, EXIF-GPS nutzen oder einen Orts-/Landmarkentext aus dem Bild finden.");
        return;
    }
    setLoading(true);
    const query = parseQuery($("#queryInput").value, sources);
    setStatus("OSM-Daten werden gezielt ueber Overpass geladen ...");
    try {
        const osmFeatures = sources.length || state.selectedEntities.size ? await fetchOverpass(sources, query) : [];
        const allFeatures = [...osmFeatures, ...state.importedFeatures];
        refreshDynamicEntities(allFeatures);
        if (!allFeatures.length) {
            renderResults([], query);
            setStatus("Keine passenden Daten im Suchraum gefunden. Radius, Ort oder Datenquellen anpassen.");
            return;
        }
        const scored = scoreFeatures(allFeatures, query)
            .sort((a, b) => b.score - a.score)
            .slice(0, Number($("#limitSelect").value));
        state.results = scored;
        renderResults(scored, query);
        setStatus(`${scored.length} Punkte bewertet. Hoehere Werte bedeuten bessere Uebereinstimmung mit Query und Umgebung.`);
    } catch (error) {
        setStatus(`Analyse fehlgeschlagen: ${error.message}`);
    } finally {
        setLoading(false);
    }
}

async function fetchOverpass(sources, query) {
    const queryRadius = Math.min(radius(), hasFocusedQuery(query) ? 1800 : 1100);
    const plans = buildOverpassPlans(sources, query);
    if (!plans.length) return [];
    const rawLimit = Math.max(160, Math.min(900, Number($("#limitSelect").value) * (plans.length <= 3 ? 8 : 5)));
    const labels = plans.map((plan) => plan.label).slice(0, 5).join(", ");
    setStatus(`Lade fokussierte OSM-Abfrage: ${labels}${plans.length > 5 ? " ..." : ""}`);
    try {
        const primary = await fetchOverpassPlans(plans, queryRadius, rawLimit, 14000);
        if (primary.length) return primary;
        const emptyFallback = await fetchPhotonFallback(plans, queryRadius, rawLimit);
        if (emptyFallback.length) {
            setStatus("Overpass lieferte keine Treffer. Fallback ueber Photon geladen.");
            return emptyFallback;
        }
        return [];
    } catch (combinedError) {
        const fastFallback = await fetchPhotonFallback(plans, queryRadius, rawLimit);
        if (fastFallback.length) {
            setStatus("Overpass war langsam. Fallback ueber Photon geladen.");
            return fastFallback;
        }
        setStatus("Sammelabfrage langsam. Versuche kleine Fallback-Abfragen ...");
        const features = [];
        const failures = [];
        for (const plan of plans.slice(0, 6)) {
            try {
                const part = await fetchOverpassPlans([plan], queryRadius, Math.max(80, Math.floor(rawLimit / 3)), 7000);
                features.push(...part);
                if (features.length >= rawLimit) break;
            } catch (error) {
                failures.push(`${plan.label}: ${error.message}`);
            }
        }
        if (!features.length) {
            const fallback = await fetchPhotonFallback(plans, queryRadius, rawLimit);
            if (fallback.length) {
                setStatus("Overpass war langsam. Fallback ueber Photon geladen.");
                return fallback;
            }
            const nominatimFallback = await fetchNominatimFallback(plans, queryRadius, rawLimit);
            if (nominatimFallback.length) {
                setStatus("Overpass war langsam. Fallback ueber Nominatim geladen.");
                return nominatimFallback;
            }
            throw new Error(`Overpass antwortet nicht schnell genug. ${failures[0] || combinedError.message}`);
        }
        if (failures.length) setStatus(`Teilergebnis geladen. Langsam: ${failures.map((failure) => failure.split(":")[0]).join(", ")}.`);
        return dedupeFeatures(features);
    }
}

async function fetchOverpassPlans(plans, queryRadius, rawLimit, timeoutMs) {
    const queryParts = plans.map((plan) => plan.query).join("");
    const query = `[out:json][timeout:${Math.ceil(timeoutMs / 1000)}];(${queryParts});out center qt ${rawLimit};`
        .replaceAll("RADIUS", String(queryRadius))
        .replaceAll("LAT", String(state.center[0]))
        .replaceAll("LON", String(state.center[1]));
    try {
        const data = await Promise.any(overpassEndpoints.map((endpoint) => requestOverpass(endpoint, query, timeoutMs)));
        return dedupeFeatures(data.elements.map(osmElementToFeature).filter(Boolean));
    } catch (error) {
        const reason = error.errors?.[0]?.message || error.message;
        throw new Error(reason || "Keine Overpass-Antwort erhalten");
    }
}

function buildOverpassPlans(sources, query) {
    const plans = [];
    selectedEntityObjects().forEach((item) => plans.push({ id: `entity-${item.id}`, label: item.label, query: item.query }));
    focusedQueryRules.forEach((rule) => {
        if (rule.terms.some((term) => query.raw.includes(normalize(term)))) {
            plans.push({ id: `focus-${rule.id}`, label: rule.label, query: rule.query });
        }
    });
    plans.push(...focusedCountrySignPlans(query));
    if (!plans.length) {
        sources.forEach((source) => {
            const queryPart = sourceQueries[source];
            if (queryPart) plans.push({ id: `source-${source}`, label: sourceLabel(source), query: queryPart });
        });
    }
    return dedupePlans(plans);
}

function hasFocusedQuery(query) {
    return Boolean(state.selectedEntities.size) || focusedQueryRules.some((rule) => rule.terms.some((term) => query.raw.includes(normalize(term))));
}

function dedupePlans(plans) {
    const seen = new Set();
    return plans.filter((plan) => {
        const key = plan.query;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

async function requestOverpass(endpoint, query, timeoutMs) {
    const body = new URLSearchParams({ data: query });
    const response = await fetchWithTimeout(endpoint, {
        method: "POST",
        headers: {
            "Accept": "application/json",
            "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
        },
        body,
    }, timeoutMs);
    return await parseOverpassResponse(response);
}

async function fetchPhotonFallback(plans, queryRadius, rawLimit) {
    const terms = dedupeText(plans.flatMap(nominatimTermsForPlan)).slice(0, 5);
    if (!terms.length) return [];
    const features = [];
    for (const term of terms) {
        setStatus(`Fallback-Suche: ${term} ...`);
        const params = new URLSearchParams({
            q: term,
            lat: String(state.center[0]),
            lon: String(state.center[1]),
            limit: String(Math.max(8, Math.min(35, Math.ceil(rawLimit / Math.max(terms.length, 1))))),
        });
        try {
            const response = await fetchWithTimeout(`https://photon.komoot.io/api/?${params}`, {
                method: "GET",
                headers: { "Accept": "application/geo+json" },
            }, 9000);
            if (!response.ok) continue;
            const data = await response.json();
            features.push(...(data.features || []).map((feature, index) => photonFeatureToFeature(feature, term, index)).filter((feature) => {
                return feature && distanceMeters(state.center[0], state.center[1], feature.lat, feature.lon) <= queryRadius * 1.35;
            }));
        } catch {
            // Keep trying the remaining terms; this is only a resilience fallback.
        }
    }
    return dedupeFeatures(features).slice(0, rawLimit);
}

function photonFeatureToFeature(feature, term, index) {
    const coordinates = feature.geometry?.coordinates;
    if (!coordinates || coordinates.length < 2) return null;
    const props = feature.properties || {};
    const tags = {
        name: props.name || term,
        class: props.osm_key,
        type: props.osm_value,
        search: term,
        city: props.city,
        street: props.street,
        country: props.country,
    };
    if (props.osm_key && props.osm_value) tags[props.osm_key] = props.osm_value;
    return {
        id: `photon-${term}-${props.osm_type || "x"}-${props.osm_id || index}`,
        source: "Photon",
        lat: Number(coordinates[1]),
        lon: Number(coordinates[0]),
        name: props.name || `${term} ${index + 1}`,
        tags,
    };
}

async function fetchNominatimFallback(plans, queryRadius, rawLimit) {
    const terms = dedupeText(plans.flatMap(nominatimTermsForPlan)).slice(0, 5);
    if (!terms.length) return [];
    const bbox = bboxAround(state.center, queryRadius);
    const features = [];
    for (const term of terms) {
        setStatus(`Fallback-Suche: ${term} ...`);
        const params = new URLSearchParams({
            format: "geojson",
            q: term,
            limit: String(Math.max(8, Math.min(30, Math.ceil(rawLimit / Math.max(terms.length, 1))))),
            bounded: "1",
            viewbox: `${bbox.west},${bbox.north},${bbox.east},${bbox.south}`,
            addressdetails: "0",
            extratags: "1",
            namedetails: "1",
        });
        try {
            const response = await fetchWithTimeout(`https://nominatim.openstreetmap.org/search?${params}`, {
                method: "GET",
                headers: { "Accept": "application/geo+json" },
            }, 9000);
            const data = await response.json();
            features.push(...(data.features || []).map((feature, index) => nominatimFeatureToFeature(feature, term, index)).filter(Boolean));
        } catch {
            // Keep trying the remaining terms; this is only a resilience fallback.
        }
    }
    return dedupeFeatures(features).slice(0, rawLimit);
}

function nominatimTermsForPlan(plan) {
    const id = plan.id.replace(/^entity-|^focus-/, "");
    const byId = {
        restaurant: ["restaurant"],
        cafe: ["cafe"],
        church: ["church", "place of worship"],
        parking: ["parking"],
        historic: ["historic", "monument"],
        school: ["school"],
        playground: ["playground"],
        supermarket: ["supermarket"],
        bus_stop: ["bus stop"],
        viewpoint: ["viewpoint"],
        tower_building: ["tower", "high-rise building", "skyscraper"],
        jentower: ["Jentower", "JenTower Jena", "Intershop Tower"],
        alley: ["Gasse", "pedestrian street", "old town alley"],
        cobblestone: ["cobblestone street", "paving stones"],
        outdoor_seating: ["outdoor seating cafe", "restaurant terrace"],
        church_tower: ["church tower", "Stadtkirche"],
        power_pole: ["power pole", "utility pole"],
        street_lamp: ["street lamp"],
        traffic_signal: ["traffic lights"],
        speed_camera: ["speed camera"],
        telecom_mast: ["communication mast", "telecommunication tower"],
        fire_hydrant: ["fire hydrant"],
        post_box: ["post box"],
        bench: ["bench"],
        guidepost: ["guidepost"],
    };
    if (byId[id]) return byId[id];
    if (/restaurant/i.test(plan.label)) return ["restaurant"];
    if (/cafe/i.test(plan.label)) return ["cafe"];
    if (/kirche/i.test(plan.label)) return ["church"];
    if (/parkplatz/i.test(plan.label)) return ["parking"];
    if (/histor/i.test(plan.label)) return ["historic"];
    if (/jentower|jen tower|intershop/i.test(plan.label)) return ["Jentower"];
    if (/hochhaus|turm|tower/i.test(plan.label)) return ["tower", "high-rise building"];
    if (/gasse|kopfstein|pflaster/i.test(plan.label)) return ["Gasse", "cobblestone street"];
    if (/aussengastronomie|outdoor/i.test(plan.label)) return ["outdoor seating cafe"];
    if (/kirchturm|stadtkirche/i.test(plan.label)) return ["church tower"];
    if (/strommast|stromleitung|umspannwerk/i.test(plan.label)) return ["power pole"];
    if (/laterne/i.test(plan.label)) return ["street lamp"];
    if (/ampel/i.test(plan.label)) return ["traffic lights"];
    if (/blitzer/i.test(plan.label)) return ["speed camera"];
    if (/zebrastreifen|fussgaenger|fußgänger/i.test(plan.label)) return ["crossing"];
    if (/funkmast/i.test(plan.label)) return ["communication mast"];
    return [];
}

function nominatimFeatureToFeature(feature, term, index) {
    const coordinates = feature.geometry?.coordinates;
    if (!coordinates || coordinates.length < 2) return null;
    const props = feature.properties || {};
    const tags = {
        name: props.name || props.display_name || term,
        class: props.class,
        type: props.type,
        search: term,
        ...(props.extratags || {}),
    };
    if (props.class && props.type) tags[props.class] = props.type;
    return {
        id: `nominatim-${term}-${props.osm_type || "x"}-${props.osm_id || index}`,
        source: "Nominatim",
        lat: Number(coordinates[1]),
        lon: Number(coordinates[0]),
        name: props.name || props.display_name || `${term} ${index + 1}`,
        tags,
    };
}

function bboxAround(center, meters) {
    const [lat, lon] = center;
    const latDelta = meters / 111320;
    const lonDelta = meters / (111320 * Math.max(Math.cos(lat * Math.PI / 180), .2));
    return {
        west: lon - lonDelta,
        south: lat - latDelta,
        east: lon + lonDelta,
        north: lat + latDelta,
    };
}

function dedupeText(values) {
    const seen = new Set();
    return values.filter((value) => {
        const key = normalize(value);
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

async function parseOverpassResponse(response) {
    const text = await response.text();
    if (!response.ok) {
        const clean = text.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
        throw new Error(`HTTP ${response.status}${clean ? ` ${clean.slice(0, 120)}` : ""}`);
    }
    try {
        return JSON.parse(text);
    } catch {
        throw new Error("Overpass lieferte kein JSON");
    }
}

async function fetchWithTimeout(url, options, timeoutMs) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
        return await fetch(url, { ...options, signal: controller.signal });
    } catch (error) {
        if (error.name === "AbortError") throw new Error(`Overpass-Timeout nach ${Math.round(timeoutMs / 1000)} Sekunden`);
        throw error;
    } finally {
        clearTimeout(timeout);
    }
}

function setLoading(isLoading) {
    state.loading = isLoading;
    $("#runBtn").disabled = isLoading;
    $("#runBtn").textContent = isLoading ? "Laedt ..." : "Analyse starten";
}

function sourceLabel(source) {
    return {
        building: "Gebaeude",
        vegetation: "Vegetation",
        poi: "POIs",
        transport: "Verkehr",
        water: "Wasser",
    }[source] || source;
}

function dedupeFeatures(features) {
    const seen = new Set();
    return features.filter((feature) => {
        if (seen.has(feature.id)) return false;
        seen.add(feature.id);
        return true;
    });
}

function osmElementToFeature(element) {
    const lat = element.lat ?? element.center?.lat;
    const lon = element.lon ?? element.center?.lon;
    if (typeof lat !== "number" || typeof lon !== "number") return null;
    const tags = element.tags || {};
    return {
        id: `osm-${element.type}-${element.id}`,
        source: "OSM",
        lat,
        lon,
        name: tags.name || readableType(tags) || `${element.type} ${element.id}`,
        tags,
    };
}

function readableType(tags) {
    const keys = ["amenity", "shop", "tourism", "historic", "building", "natural", "landuse", "leisure", "highway", "waterway"];
    const key = keys.find((candidate) => tags[candidate]);
    return key ? `${key}: ${tags[key]}` : "";
}

function parseQuery(raw, fallbackSources) {
    const text = normalize(raw);
    const active = new Set(fallbackSources);
    const entities = selectedEntityObjects();
    const entityTerms = entities.flatMap((item) => [item.label, ...item.terms]).map(normalize);
    const terms = text.split(/[^a-z0-9äöüß]+/i).filter((term) => term.length > 2);
    Object.entries(queryLexicon).forEach(([group, words]) => {
        if (words.some((word) => text.includes(normalize(word)))) active.add(group);
    });
    entities.forEach((item) => active.add(item.group));
    return {
        raw: text,
        terms: Array.from(new Set([...terms, ...entityTerms])).filter((term) => term.length > 2),
        groups: Array.from(active),
        entities,
    };
}

function scoreFeatures(features, query) {
    const weights = normalizedWeights();
    const density = buildDensityIndex(features);
    return features.map((feature) => {
        const tagText = normalize(`${feature.name} ${Object.entries(feature.tags).map(([key, value]) => `${key} ${value}`).join(" ")}`);
        const groupHits = query.groups.filter((group) => matchesGroup(feature.tags, group));
        const termHits = query.terms.filter((term) => tagText.includes(term));
        const entityHits = query.entities.filter((item) => matchesEntityFeature(feature.tags, item));
        const distanceScore = Math.max(0, 1 - distanceMeters(state.center[0], state.center[1], feature.lat, feature.lon) / radius());
        const localDensity = density.get(feature.id) || 0;
        const entityScore = query.entities.length ? entityHits.length / query.entities.length : 0;
        const poiScore = clamp((termHits.length / Math.max(query.terms.length, 1)) * .45 + (groupHits.length / Math.max(query.groups.length, 1)) * .25 + entityScore * .55);
        const contextScore = clamp(distanceScore * .5 + groupHits.length * .14 + relationBonus(feature.tags, query.groups));
        const densityScore = clamp(localDensity / 12);
        const reviews = findReviewsForFeature(feature);
        const reviewScore = reviewConfidence(reviews);
        const score = Math.round(100 * clamp(poiScore * weights.poi + contextScore * weights.context + densityScore * weights.density + reviewScore * .06));
        return {
            ...feature,
            reviews,
            score,
            factors: {
                query: Math.round(poiScore * 100),
                context: Math.round(contextScore * 100),
                density: Math.round(densityScore * 100),
                reviews: Math.round(reviewScore * 100),
                hits: [...entityHits.map((item) => item.label), ...termHits, ...groupHits].slice(0, 8),
            },
        };
    });
}

function normalizedWeights() {
    const poi = Number($("#poiWeight").value);
    const context = Number($("#contextWeight").value);
    const density = Number($("#densityWeight").value);
    const sum = Math.max(1, poi + context + density);
    return { poi: poi / sum, context: context / sum, density: density / sum };
}

function matchesGroup(tags, group) {
    const keys = tagGroups[group] || [];
    return keys.some((key) => Object.prototype.hasOwnProperty.call(tags, key));
}

function matchesEntityFeature(tags, item) {
    return item.matchers.some((matcher) => {
        const value = normalize(tags[matcher.key]);
        const expectedValues = matcher.values.flatMap((expected) => String(expected).split("|")).filter(Boolean);
        return value && (!expectedValues.length || expectedValues.some((expected) => value.includes(normalize(expected))));
    });
}

function relationBonus(tags, groups) {
    let bonus = 0;
    if (groups.includes("vegetation") && (tags.leisure === "playground" || tags.leisure === "park")) bonus += .12;
    if (groups.includes("building") && tags.building && tags.building !== "no") bonus += .16;
    if (groups.includes("transport") && (tags.highway || tags.public_transport || tags.railway)) bonus += .14;
    if (groups.includes("water") && (tags.waterway || tags.water || tags.bridge)) bonus += .14;
    if (groups.includes("poi") && (tags.amenity || tags.shop || tags.tourism || tags.historic)) bonus += .18;
    return bonus;
}

function buildDensityIndex(features) {
    const index = new Map(features.map((feature) => [feature.id, 0]));
    for (let i = 0; i < features.length; i += 1) {
        for (let j = i + 1; j < features.length; j += 1) {
            if (distanceMeters(features[i].lat, features[i].lon, features[j].lat, features[j].lon) <= 160) {
                index.set(features[i].id, index.get(features[i].id) + 1);
                index.set(features[j].id, index.get(features[j].id) + 1);
            }
        }
    }
    return index;
}

function renderResults(results, query) {
    clearResultMarkers();
    const list = $("#resultList");
    list.innerHTML = "";
    $("#resultCount").textContent = results.length;
    $("#bestScore").textContent = results.length ? `${results[0].score}%` : "0%";
    renderFactors(results, query);
    const bounds = [];
    results.forEach((result, index) => {
        const marker = createMarker(result);
        state.resultSource.addFeature(marker);
        bounds.push([result.lat, result.lon]);
        const item = resultListItem(result, index, marker);
        list.appendChild(item);
    });
    if (bounds.length) fitResultBounds(bounds);
}

function clearResultMarkers() {
    state.resultSource.clear();
    hidePopup();
}

function fitResultBounds(points) {
    if (!points.length) return;
    const extent = ol.extent.boundingExtent(points.map(([lat, lon]) => ol.proj.fromLonLat([lon, lat])));
    state.view.fit(extent, {
        padding: [90, 90, 90, 90],
        maxZoom: 16,
        duration: 550,
    });
}

function renderFactors(results, query) {
    const factorList = $("#factorList");
    const avg = (key) => results.length ? Math.round(results.reduce((sum, item) => sum + item.factors[key], 0) / results.length) : 0;
    factorList.innerHTML = "";
    [
        ["Query-Tags", `${avg("query")}%`],
        ["Umgebung", `${avg("context")}%`],
        ["Dichte", `${avg("density")}%`],
        ["Reviews", state.reviewRecords.length ? `${state.reviewRecords.length} geladen` : "keine"],
        ["Entitaeten", selectedEntityObjects().map((item) => item.label).join(", ") || "keine"],
        ["Aktive Gruppen", query.groups.join(", ") || "keine"],
    ].forEach(([name, value]) => {
        const row = document.createElement("div");
        row.className = "factor";
        row.innerHTML = `<span>${escapeHtml(name)}</span><strong>${escapeHtml(value)}</strong>`;
        factorList.appendChild(row);
    });
}

function createMarker(result) {
    const feature = new ol.Feature({
        geometry: new ol.geom.Point(ol.proj.fromLonLat([result.lon, result.lat])),
        result,
        popupHtml: popupHtml(result),
    });
    return feature;
}

function popupHtml(result) {
    const tags = Object.entries(result.tags).slice(0, 8).map(([key, value]) => `${key}=${value}`).join(", ");
    return `<p class="popup-title">${escapeHtml(result.name)}</p>
        <strong>${result.score}% Wahrscheinlichkeit</strong>
        <div>Query ${result.factors.query}% · Umgebung ${result.factors.context}% · Dichte ${result.factors.density}%</div>
        ${reviewsHtml(result)}
        ${externalLinksHtml(result)}
        <p class="popup-tags">${escapeHtml(tags)}</p>`;
}

function resultListItem(result, index, marker) {
    const template = $("#resultTemplate").content.cloneNode(true);
    const button = template.querySelector(".result-item");
    template.querySelector(".rank").textContent = index + 1;
    template.querySelector("strong").textContent = result.name;
    const reviewText = result.reviews?.length ? `rating ${averageRating(result.reviews).toFixed(1)} aus ${result.reviews.length} Quellen` : "";
    template.querySelector("small").textContent = [result.source, result.factors.hits.join(", ") || readableType(result.tags) || "Kontexttreffer", reviewText].filter(Boolean).join(" · ");
    template.querySelector(".probability").textContent = `${result.score}%`;
    button.addEventListener("click", () => {
        setMapView([result.lat, result.lon], 17);
        openMarkerPopup(marker);
    });
    return template;
}

function openMarkerPopup(marker) {
    openFeaturePopup(marker, marker.get("popupHtml"));
}

function openFeaturePopup(feature, html) {
    if (!html) return;
    state.popupElement.hidden = false;
    state.popupElement.innerHTML = html;
    state.popupOverlay.setPosition(feature.getGeometry().getCoordinates());
}

function hidePopup() {
    if (!state.popupElement) return;
    state.popupElement.hidden = true;
    state.popupOverlay?.setPosition(undefined);
}

function clearMap() {
    clearResultMarkers();
    state.imageSource.clear();
    state.results = [];
    $("#resultList").innerHTML = "";
    $("#resultCount").textContent = "0";
    $("#bestScore").textContent = "0%";
    $("#factorList").innerHTML = "";
    setStatus("Karte geleert.");
}

async function analyzeImageFile(event) {
    const file = event.target.files[0];
    if (!file) return;
    const buffer = await file.arrayBuffer();
    const url = URL.createObjectURL(file);
    const preview = $("#imagePreview");
    preview.src = url;
    preview.hidden = false;
    try {
        const gps = extractGpsFromExif(buffer);
        const image = await loadImage(url);
        setStatus("Bild wird lokal analysiert ...");
        let hints = analyzeImagePixels(image, gps, file.name);
        const imageSignature = imageComparisonSignature(image);
        const landmarkHints = state.searchCenterReady ? await matchNearbyLandmarkImages(imageSignature) : [];
        const textHints = await analyzeImageText(url, file.name, imageSignature);
        hints = dedupeImageHints([...landmarkHints, ...hints, ...textHints]);
        state.imageHints = hints;
        renderImageSignals(hints, gps);
        if (gps) {
            focusImageLocation({ lat: gps.lat, lon: gps.lon, zoom: 16 }, "Fotostandort aus EXIF");
            setStatus("Bild-GPS gefunden. Suchraum wurde auf das Foto gesetzt.");
        } else if (focusBestImageLocation(hints)) {
            const locationHint = hints.find((hint) => hint.location);
            setStatus(`${hints.length} Bildhinweise erkannt. Suchraum wurde auf ${locationHint.location.label || locationHint.label} gesetzt.`);
        } else {
            setStatus(`${hints.length} Bildhinweise erkannt. Mit + in die Query uebernehmen.`);
        }
    } catch (error) {
        setStatus(`Bildanalyse fehlgeschlagen: ${error.message}`);
    }
}

function loadImage(url) {
    return new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error("Bild konnte nicht geladen werden"));
        image.src = url;
    });
}

async function analyzeImageText(imageUrl, fileName, imageSignature) {
    const hints = [];
    const candidates = imageTextCandidates(fileName, "filename", .76);
    if (window.Tesseract?.recognize) {
        setStatus("Bildtext wird per OCR gesucht ...");
        const result = await promiseTimeout(window.Tesseract.recognize(imageUrl, "eng"), 14000).catch(() => null);
        const text = result?.data?.text || "";
        const ocrCandidates = imageTextCandidates(text, "ocr", .9);
        candidates.push(...ocrCandidates);
        if (ocrCandidates.length) {
            const terms = ocrCandidates.map((candidate) => candidate.term).slice(0, 3);
            hints.push(imageHint(`Text im Bild: ${terms.join(", ")}`, terms.join(", "), "poi", .7, []));
            if (!$("#imageTextInput").value.trim()) $("#imageTextInput").value = terms.join(", ");
        }
    }
    hints.push(...await resolveImagePlaceHints(candidates, { imageSignature, allowAutoFocus: state.searchCenterReady }));
    return hints;
}

async function matchNearbyLandmarkImages(uploadedSignature) {
    if (!state.searchCenterReady || !uploadedSignature) return [];
    setStatus("Sehenswuerdigkeiten im Suchraum werden mit Online-Bildern verglichen ...");
    const candidates = await fetchNearbyLandmarkCandidates();
    const wikiCandidates = await fetchWikipediaGeosearchCandidates();
    const geoCandidates = await fetchCommonsGeosearchImageCandidates();
    const allCandidates = sortLandmarkImageCandidates(dedupeLandmarkCandidates([...candidates, ...wikiCandidates, ...geoCandidates]));
    refreshDynamicEntities(allCandidates);
    if (!allCandidates.length) return [];
    const matches = [];
    for (const [index, candidate] of allCandidates.slice(0, 36).entries()) {
        if (index && index % 6 === 0) setStatus(`Bildabgleich: ${index}/${Math.min(allCandidates.length, 36)} Kandidaten ...`);
        const references = await landmarkImageReferences(candidate);
        for (const reference of references.slice(0, 4)) {
            const image = await loadCorsImage(reference.thumbUrl).catch(() => null);
            if (!image) continue;
            const referenceSignature = safeImageComparisonSignature(image);
            if (!referenceSignature) continue;
            const similarity = signatureSimilarity(uploadedSignature, referenceSignature);
            matches.push({ candidate, reference, similarity });
        }
    }
    return matches
        .sort((a, b) => b.similarity - a.similarity)
        .filter((match, index, list) => match.similarity >= .60 && list.findIndex((item) => item.candidate.id === match.candidate.id) === index)
        .slice(0, 5)
        .map((match) => nearbyLandmarkMatchHint(match));
}

function dedupeLandmarkCandidates(candidates) {
    const seen = new Set();
    return candidates.filter((candidate) => {
        const key = normalize(`${candidate.name}:${candidate.tags?.wikidata || candidate.tags?.wikipedia || ""}`);
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

function sortLandmarkImageCandidates(candidates) {
    return candidates.sort((a, b) => imageCandidatePriority(b) - imageCandidatePriority(a));
}

function imageCandidatePriority(candidate) {
    const tags = candidate.tags || {};
    const distance = distanceMeters(state.center[0], state.center[1], candidate.lat, candidate.lon);
    return (
        (candidate.imageReferences?.length ? 12 : 0)
        + (tags.image ? 9 : 0)
        + (tags.wikimedia_commons ? 8 : 0)
        + (tags.wikidata ? 7 : 0)
        + (tags.wikipedia ? 6 : 0)
        + landmarkCandidateWeight(tags)
        + Math.max(0, 4 - distance / 1200)
    );
}

async function fetchNearbyLandmarkCandidates() {
    const queryRadius = Math.max(900, Math.min(6000, radius() * 4));
    const plans = [{ id: "image-landmarks", label: "Sehenswuerdigkeiten im Suchraum", query: nearbyLandmarkQuery() }];
    try {
        const features = await fetchOverpassPlans(plans, queryRadius, 140, 10000);
        return dedupeFeatures(features)
            .filter((feature) => feature.name && landmarkCandidateWeight(feature.tags) > 0)
            .sort((a, b) => landmarkCandidateWeight(b.tags) - landmarkCandidateWeight(a.tags))
            .slice(0, 60);
    } catch {
        return [];
    }
}

async function fetchCommonsGeosearchImageCandidates() {
    const queryRadius = Math.max(900, Math.min(10000, radius() * 5));
    try {
        const params = new URLSearchParams({
            action: "query",
            list: "geosearch",
            gscoord: `${state.center[0]}|${state.center[1]}`,
            gsradius: String(queryRadius),
            gslimit: "24",
            gsnamespace: "6",
            format: "json",
            origin: "*",
        });
        const response = await fetchWithTimeout(`https://commons.wikimedia.org/w/api.php?${params}`, { headers: { "Accept": "application/json" } }, 8000);
        const data = await response.json();
        const rows = data.query?.geosearch || [];
        if (!rows.length) return [];
        const imageInfo = await commonsImageInfoByPageIds(rows.map((row) => row.pageid));
        return rows
            .map((row) => {
                const ref = imageInfo.get(String(row.pageid));
                if (!ref) return null;
                return {
                    id: `commons-geo-${row.pageid}`,
                    source: "Commons Geosearch",
                    lat: Number(row.lat),
                    lon: Number(row.lon),
                    name: ref.title,
                    tags: { image: ref.title, wikimedia_commons: `File:${ref.title}` },
                    imageReferences: [ref],
                };
            })
            .filter(Boolean);
    } catch {
        return [];
    }
}

async function fetchWikipediaGeosearchCandidates() {
    if (!state.searchCenterReady) return [];
    const langs = ["de", "en"];
    const results = [];
    for (const lang of langs) {
        results.push(...await fetchWikipediaGeosearchForLang(lang));
    }
    const seen = new Set();
    return results.filter((candidate) => {
        const key = normalize(candidate.name);
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
    }).slice(0, 36);
}

async function fetchWikipediaGeosearchForLang(lang) {
    const queryRadius = Math.max(900, Math.min(10000, radius() * 5));
    try {
        const params = new URLSearchParams({
            action: "query",
            list: "geosearch",
            gscoord: `${state.center[0]}|${state.center[1]}`,
            gsradius: String(queryRadius),
            gslimit: "24",
            format: "json",
            origin: "*",
        });
        const response = await fetchWithTimeout(`https://${lang}.wikipedia.org/w/api.php?${params}`, { headers: { "Accept": "application/json" } }, 8000);
        const data = await response.json();
        const rows = data.query?.geosearch || [];
        if (!rows.length) return [];
        const pageInfo = await wikipediaPageInfoByPageIds(lang, rows.map((row) => row.pageid));
        return rows
            .map((row) => {
                const info = pageInfo.get(String(row.pageid));
                const references = info?.thumbUrl ? [{ title: info.title, thumbUrl: info.thumbUrl, source: `${lang}.wikipedia` }] : [];
                return {
                    id: `wikipedia-${lang}-${row.pageid}`,
                    source: `${lang}.wikipedia geosearch`,
                    lat: Number(row.lat),
                    lon: Number(row.lon),
                    name: info?.title || row.title,
                    tags: { wikipedia: `${lang}:${row.title}`, wikidata: info?.wikidata || "" },
                    imageReferences: references,
                };
            });
    } catch {
        return [];
    }
}

async function wikipediaPageInfoByPageIds(lang, pageIds) {
    if (!pageIds.length) return new Map();
    try {
        const params = new URLSearchParams({
            action: "query",
            pageids: pageIds.slice(0, 50).join("|"),
            prop: "pageimages|pageprops",
            pithumbsize: "320",
            format: "json",
            origin: "*",
        });
        const response = await fetchWithTimeout(`https://${lang}.wikipedia.org/w/api.php?${params}`, { headers: { "Accept": "application/json" } }, 8000);
        const data = await response.json();
        const map = new Map();
        Object.values(data.query?.pages || {}).forEach((page) => {
            map.set(String(page.pageid), {
                title: page.title,
                thumbUrl: page.thumbnail?.source || "",
                wikidata: page.pageprops?.wikibase_item || "",
            });
        });
        return map;
    } catch {
        return new Map();
    }
}

async function commonsImageInfoByPageIds(pageIds) {
    if (!pageIds.length) return new Map();
    try {
        const params = new URLSearchParams({
            action: "query",
            pageids: pageIds.slice(0, 50).join("|"),
            prop: "imageinfo",
            iiprop: "url",
            iiurlwidth: "320",
            format: "json",
            origin: "*",
        });
        const response = await fetchWithTimeout(`https://commons.wikimedia.org/w/api.php?${params}`, { headers: { "Accept": "application/json" } }, 8000);
        const data = await response.json();
        const map = new Map();
        Object.values(data.query?.pages || {}).forEach((page) => {
            const thumbUrl = page.imageinfo?.[0]?.thumburl || page.imageinfo?.[0]?.url;
            if (!thumbUrl) return;
            map.set(String(page.pageid), {
                title: String(page.title || "").replace(/^File:/, "").replace(/\.[a-z0-9]+$/i, ""),
                thumbUrl,
                source: "Commons geosearch",
            });
        });
        return map;
    } catch {
        return new Map();
    }
}

function nearbyLandmarkQuery() {
    const selectors = [
        '["tourism"~"attraction|viewpoint|museum|gallery|artwork|information"]',
        '["historic"~"monument|memorial|castle|ruins|archaeological_site|wayside_cross|building"]',
        '["amenity"="place_of_worship"]',
        '["building"~"church|cathedral|chapel|tower|public|civic|university"]',
        '["man_made"~"tower|obelisk|statue|water_tower"]',
        '["memorial"]',
        '["artwork_type"]',
        '["wikidata"]',
        '["wikipedia"]',
        '["wikimedia_commons"]',
        '["image"]',
    ];
    return selectors.flatMap((selector) => [
        `node${selector}(around:RADIUS,LAT,LON);`,
        `way${selector}(around:RADIUS,LAT,LON);`,
        `relation${selector}(around:RADIUS,LAT,LON);`,
    ]).join("");
}

function landmarkCandidateWeight(tags) {
    let score = 0;
    if (tags.wikidata || tags.wikipedia || tags.wikimedia_commons || tags.image) score += 6;
    if (tags.tourism) score += 4;
    if (tags.historic) score += 4;
    if (tags.memorial || tags.artwork_type) score += 3;
    if (tags.man_made) score += 2;
    if (tags.amenity === "place_of_worship") score += 2;
    if (tags.name) score += 1;
    return score;
}

async function landmarkImageReferences(candidate) {
    const refs = [];
    const tags = candidate.tags || {};
    refs.push(...(candidate.imageReferences || []));
    refs.push(...await directImageReferences(tags.image));
    refs.push(...await commonsTagReferences(tags.wikimedia_commons));
    if (tags.wikidata) refs.push(...await wikidataImageReferences(tags.wikidata));
    if (tags.wikipedia) refs.push(...await wikipediaImageReferences(tags.wikipedia));
    if (candidate.name) {
        const context = localPlaceContextText();
        refs.push(...await searchCommonsImages(`${candidate.name} ${context}`.trim()));
        if (!refs.length) refs.push(...await searchCommonsImages(candidate.name));
    }
    return dedupeImageReferences(refs).slice(0, 8);
}

function nearbyLandmarkMatchHint(match) {
    const confidence = clamp(.28 + match.similarity * .72);
    const name = match.candidate.name || match.reference.title;
    return imageHint(
        `Bildmatch im Suchraum: ${name}`,
        `${name}, ${match.reference.title}`,
        "poi",
        confidence,
        [],
        {
            lat: match.candidate.lat,
            lon: match.candidate.lon,
            zoom: 17,
            label: `${name} · Referenz: ${match.reference.title}`,
            autofocus: confidence >= .9,
        },
    );
}

function localPlaceContextText() {
    const raw = $("#placeInput")?.value?.trim() || "";
    return raw && !/^-?\d/.test(raw) ? raw : "";
}

async function resolveManualImageText() {
    const raw = $("#imageTextInput").value.trim();
    if (!raw) {
        setStatus("Erst einen Orts-, Landmarken- oder Schrift-Hinweis eingeben.");
        return;
    }
    setStatus("Ortskandidaten werden weltweit gesucht ...");
    const candidates = imageTextCandidates(raw, "manual", .96);
    const hints = await resolveImagePlaceHints(candidates, { allowGlobal: true, allowAutoFocus: true });
    if (!hints.length) {
        setStatus("Kein globaler Ortskandidat gefunden. Text praezisieren, z. B. Landmarke + Stadt/Land.");
        return;
    }
    state.imageHints = dedupeImageHints([...state.imageHints, ...hints]);
    renderImageSignals(state.imageHints, null);
    focusBestImageLocation(state.imageHints);
    setStatus(`${hints.length} globale Ortskandidaten gefunden.`);
}

function imageTextCandidates(text, source, confidence) {
    const raw = source === "filename" ? fileNameToText(text) : text;
    const lines = raw
        .split(/[\r\n,;|]+/)
        .map((line) => cleanImageTextCandidate(line))
        .filter(Boolean);
    const phrase = cleanImageTextCandidate(raw);
    if (phrase) lines.push(phrase);
    const seen = new Set();
    return lines
        .flatMap((line) => splitCandidatePhrases(line))
        .map((term) => ({ term, source, confidence }))
        .filter((candidate) => {
            const key = normalize(candidate.term);
            if (seen.has(key) || !isUsefulPlaceCandidate(candidate.term)) return false;
            seen.add(key);
            return true;
        })
        .slice(0, 6);
}

function fileNameToText(fileName) {
    return String(fileName || "")
        .replace(/\.[a-z0-9]{2,5}$/i, "")
        .replace(/[_-]+/g, " ")
        .replace(/\b(img|dsc|dcim|photo|bild|screenshot|whatsapp|signal|telegram)\b/gi, " ")
        .replace(/\b\d{4}[- ]?\d{2}[- ]?\d{2}\b/g, " ")
        .replace(/\b\d{6,}\b/g, " ");
}

function cleanImageTextCandidate(value) {
    return String(value || "")
        .replace(/[^\p{L}\p{N}\s.'&-]/gu, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 72);
}

function splitCandidatePhrases(line) {
    const words = line.split(/\s+/).filter(Boolean);
    if (words.length <= 4) return [line];
    const chunks = [];
    for (let i = 0; i < words.length - 1; i += 1) {
        chunks.push(words.slice(i, Math.min(words.length, i + 4)).join(" "));
    }
    return chunks;
}

function isUsefulPlaceCandidate(term) {
    const value = normalize(term);
    if (value.length < 4 || value.length > 48) return false;
    if (!/[a-z]/.test(value)) return false;
    if (/^\d/.test(value)) return false;
    const generic = new Set([
        "street", "strasse", "straße", "road", "avenue", "platz", "place", "restaurant", "cafe", "bar", "hotel",
        "shop", "open", "closed", "stop", "exit", "entry", "parking", "pizza", "menu", "wc", "toilet", "welcome",
        "photo", "image", "screenshot", "whatsapp", "telegram", "unknown", "gvis",
    ]);
    if (generic.has(value)) return false;
    if (value.split(/\s+/).every((word) => generic.has(word))) return false;
    return true;
}

async function resolveImagePlaceHints(candidates, options = {}) {
    const hints = [];
    const seen = new Set();
    for (const candidate of candidates.slice(0, 5)) {
        const key = normalize(candidate.term);
        if (seen.has(key)) continue;
        seen.add(key);
        const place = await geocodeCandidateTerm(candidate, options);
        if (place) {
            const confidence = place.contextual ? Math.max(.9, candidate.confidence) : candidate.source === "manual" ? .96 : .72;
            hints.push(imageHint(
                `${place.contextual ? "lokaler Ortskandidat" : "Ortskandidat"}: ${place.name}`,
                candidate.term,
                "poi",
                confidence,
                [],
                {
                    lat: place.lat,
                    lon: place.lon,
                    zoom: place.zoom,
                    label: place.label,
                    autofocus: Boolean(options.allowAutoFocus && (place.contextual || candidate.source === "manual")),
                },
            ));
        }
        if (options.imageSignature && (candidate.source === "manual" || candidate.source === "ocr")) {
            const reference = await commonsReferenceMatch(candidate.term, options.imageSignature);
            if (reference) {
                hints.push(imageHint(
                    `Online-Bildreferenz: ${reference.title}`,
                    `${candidate.term}, ${reference.title}`,
                    "poi",
                    reference.confidence,
                    [],
                ));
            }
        }
    }
    return hints;
}

async function geocodeCandidateTerm(candidate, options = {}) {
    if (state.searchCenterReady) {
        const local = await geocodeLocalTerm(candidate.term);
        if (local) return { ...local, contextual: true };
    }
    if (options.allowGlobal || candidate.source === "manual") {
        const global = await geocodeGlobalTerm(candidate.term);
        if (global) return { ...global, contextual: false };
    }
    return null;
}

async function geocodeLocalTerm(term) {
    const maxDistance = imageContextRadius();
    return await geocodePhotonTerm(term, { center: state.center, maxDistance, limit: 6 })
        || await geocodeNominatimTerm(term, { bbox: bboxAround(state.center, maxDistance), bounded: true, maxDistance });
}

function imageContextRadius() {
    return Math.max(3500, Math.min(30000, radius() * 12));
}

async function geocodeGlobalTerm(term) {
    return await geocodePhotonTerm(term) || await geocodeNominatimTerm(term);
}

async function geocodePhotonTerm(term, options = {}) {
    try {
        const params = new URLSearchParams({ q: term, limit: String(options.limit || 1) });
        if (options.center) {
            params.set("lat", String(options.center[0]));
            params.set("lon", String(options.center[1]));
        }
        const response = await fetchWithTimeout(`https://photon.komoot.io/api/?${params}`, { headers: { "Accept": "application/json" } }, 7000);
        const data = await response.json();
        const feature = bestGeocoderFeature(data.features || [], term, options);
        const coordinates = feature?.geometry?.coordinates;
        if (!coordinates) return null;
        const props = feature.properties || {};
        const name = [props.name, props.city, props.country].filter(Boolean).join(", ");
        return {
            name: props.name || term,
            label: name || term,
            lat: Number(coordinates[1]),
            lon: Number(coordinates[0]),
            zoom: geocodeZoom(props.osm_key, props.osm_value),
        };
    } catch {
        return null;
    }
}

async function geocodeNominatimTerm(term, options = {}) {
    try {
        const params = new URLSearchParams({
            format: "geojson",
            q: term,
            limit: String(options.limit || 6),
            addressdetails: "0",
            extratags: "1",
        });
        if (options.bounded && options.bbox) {
            params.set("bounded", "1");
            params.set("viewbox", `${options.bbox.west},${options.bbox.north},${options.bbox.east},${options.bbox.south}`);
        }
        const response = await fetchWithTimeout(`https://nominatim.openstreetmap.org/search?${params}`, { headers: { "Accept": "application/geo+json" } }, 7000);
        const data = await response.json();
        const feature = bestGeocoderFeature(data.features || [], term, options);
        const coordinates = feature?.geometry?.coordinates;
        if (!coordinates) return null;
        const props = feature.properties || {};
        return {
            name: props.name || term,
            label: props.display_name || props.name || term,
            lat: Number(coordinates[1]),
            lon: Number(coordinates[0]),
            zoom: geocodeZoom(props.class, props.type),
        };
    } catch {
        return null;
    }
}

function bestGeocoderFeature(features, term, options = {}) {
    const normalizedTerm = normalize(term);
    const scored = features
        .map((feature) => {
            const coordinates = feature.geometry?.coordinates;
            if (!coordinates || coordinates.length < 2) return null;
            const props = feature.properties || {};
            const lat = Number(coordinates[1]);
            const lon = Number(coordinates[0]);
            const distance = options.center ? distanceMeters(options.center[0], options.center[1], lat, lon) : 0;
            if (options.maxDistance && distance > options.maxDistance) return null;
            const text = normalize(`${props.name || ""} ${props.display_name || ""} ${props.city || ""} ${props.country || ""} ${props.osm_key || ""} ${props.osm_value || ""} ${props.class || ""} ${props.type || ""}`);
            const exactName = normalize(props.name || "") === normalizedTerm ? .45 : 0;
            const contains = text.includes(normalizedTerm) ? .24 : 0;
            const landmark = /tourism|historic|amenity|building|shop|place|highway/.test(text) ? .12 : 0;
            const distanceScore = options.center ? Math.max(0, 1 - distance / Math.max(options.maxDistance || 1, 1)) * .28 : 0;
            return { feature, score: exactName + contains + landmark + distanceScore };
        })
        .filter(Boolean)
        .sort((a, b) => b.score - a.score);
    return scored[0]?.feature || null;
}

function geocodeZoom(key, value) {
    const text = normalize(`${key} ${value}`);
    if (/tourism|amenity|shop|historic|building|attraction|viewpoint|tower/.test(text)) return 17;
    if (/highway|street|road|pedestrian/.test(text)) return 16;
    if (/city|town|village|municipality|place/.test(text)) return 12;
    return 14;
}

async function commonsReferenceMatch(term, uploadedSignature) {
    const references = await searchCommonsImages(term);
    let best = null;
    for (const reference of references.slice(0, 4)) {
        const image = await loadCorsImage(reference.thumbUrl).catch(() => null);
        if (!image) continue;
        const signature = safeImageComparisonSignature(image);
        if (!signature) continue;
        const similarity = signatureSimilarity(uploadedSignature, signature);
        if (!best || similarity > best.similarity) best = { ...reference, similarity };
    }
    if (!best || best.similarity < .58) return null;
    return {
        ...best,
        confidence: clamp(.48 + best.similarity * .42),
    };
}

async function directImageReferences(value) {
    if (!value) return [];
    const raw = String(value).trim();
    if (/^https?:\/\//i.test(raw)) return [{ title: raw.split("/").pop() || "Direktbild", thumbUrl: raw, source: "OSM image" }];
    return await commonsTagReferences(raw);
}

async function commonsTagReferences(value) {
    if (!value) return [];
    const raw = String(value).trim().replace(/^https?:\/\/commons\.wikimedia\.org\/wiki\//i, "");
    if (/^category:/i.test(raw)) return await commonsCategoryImages(raw);
    return await commonsFileImages(raw);
}

async function wikidataImageReferences(qid) {
    const id = String(qid || "").trim();
    if (!/^Q\d+$/i.test(id)) return [];
    try {
        const response = await fetchWithTimeout(`https://www.wikidata.org/wiki/Special:EntityData/${encodeURIComponent(id)}.json`, { headers: { "Accept": "application/json" } }, 8000);
        const data = await response.json();
        const entity = data.entities?.[id.toUpperCase()];
        const claims = entity?.claims || {};
        const images = (claims.P18 || [])
            .map((claim) => claim.mainsnak?.datavalue?.value)
            .filter(Boolean);
        const categories = (claims.P373 || [])
            .map((claim) => claim.mainsnak?.datavalue?.value)
            .filter(Boolean);
        const refs = [];
        for (const image of images.slice(0, 3)) refs.push(...await commonsFileImages(image));
        for (const category of categories.slice(0, 2)) refs.push(...await commonsCategoryImages(`Category:${category}`));
        return refs;
    } catch {
        return [];
    }
}

async function wikipediaImageReferences(tag) {
    const parsed = parseWikipediaTag(tag);
    if (!parsed) return [];
    try {
        const params = new URLSearchParams({
            action: "query",
            titles: parsed.title,
            prop: "pageimages|pageprops",
            pithumbsize: "320",
            format: "json",
            origin: "*",
        });
        const response = await fetchWithTimeout(`https://${parsed.lang}.wikipedia.org/w/api.php?${params}`, { headers: { "Accept": "application/json" } }, 8000);
        const data = await response.json();
        const page = Object.values(data.query?.pages || {})[0];
        const refs = [];
        if (page?.thumbnail?.source) refs.push({ title: page.title || parsed.title, thumbUrl: page.thumbnail.source, source: "Wikipedia" });
        const qid = page?.pageprops?.wikibase_item;
        if (qid) refs.push(...await wikidataImageReferences(qid));
        return refs;
    } catch {
        return [];
    }
}

function parseWikipediaTag(value) {
    const raw = String(value || "").trim();
    const match = raw.match(/^([a-z-]+):(.+)$/i);
    if (!match) return null;
    return { lang: match[1].toLowerCase(), title: match[2].replace(/_/g, " ") };
}

async function commonsFileImages(value) {
    const title = normalizeCommonsFileTitle(value);
    if (!title) return [];
    try {
        const params = new URLSearchParams({
            action: "query",
            titles: title,
            prop: "imageinfo",
            iiprop: "url",
            iiurlwidth: "320",
            format: "json",
            origin: "*",
        });
        const response = await fetchWithTimeout(`https://commons.wikimedia.org/w/api.php?${params}`, { headers: { "Accept": "application/json" } }, 8000);
        const data = await response.json();
        return Object.values(data.query?.pages || {})
            .map((page) => ({
                title: String(page.title || title).replace(/^File:/, "").replace(/\.[a-z0-9]+$/i, ""),
                thumbUrl: page.imageinfo?.[0]?.thumburl || page.imageinfo?.[0]?.url,
                source: "Commons",
            }))
            .filter((item) => item.thumbUrl);
    } catch {
        return [];
    }
}

async function commonsCategoryImages(value) {
    const title = normalizeCommonsCategoryTitle(value);
    if (!title) return [];
    try {
        const params = new URLSearchParams({
            action: "query",
            generator: "categorymembers",
            gcmtitle: title,
            gcmnamespace: "6",
            gcmlimit: "6",
            prop: "imageinfo",
            iiprop: "url",
            iiurlwidth: "320",
            format: "json",
            origin: "*",
        });
        const response = await fetchWithTimeout(`https://commons.wikimedia.org/w/api.php?${params}`, { headers: { "Accept": "application/json" } }, 8000);
        const data = await response.json();
        return Object.values(data.query?.pages || {})
            .map((page) => ({
                title: String(page.title || "").replace(/^File:/, "").replace(/\.[a-z0-9]+$/i, ""),
                thumbUrl: page.imageinfo?.[0]?.thumburl || page.imageinfo?.[0]?.url,
                source: "Commons category",
            }))
            .filter((item) => item.thumbUrl);
    } catch {
        return [];
    }
}

function normalizeCommonsFileTitle(value) {
    if (!value) return "";
    const decoded = decodeURIComponent(String(value).trim()).replace(/_/g, " ");
    if (/^file:/i.test(decoded)) return decoded.replace(/^file:/i, "File:");
    if (/^category:/i.test(decoded)) return "";
    return `File:${decoded}`;
}

function normalizeCommonsCategoryTitle(value) {
    if (!value) return "";
    const decoded = decodeURIComponent(String(value).trim()).replace(/_/g, " ");
    return /^category:/i.test(decoded) ? decoded.replace(/^category:/i, "Category:") : `Category:${decoded}`;
}

function dedupeImageReferences(refs) {
    const seen = new Set();
    return refs.filter((ref) => {
        const key = ref.thumbUrl || ref.title;
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

async function searchCommonsImages(term) {
    try {
        const params = new URLSearchParams({
            action: "query",
            generator: "search",
            gsrsearch: term,
            gsrnamespace: "6",
            gsrlimit: "5",
            prop: "imageinfo",
            iiprop: "url",
            iiurlwidth: "260",
            format: "json",
            origin: "*",
        });
        const response = await fetchWithTimeout(`https://commons.wikimedia.org/w/api.php?${params}`, { headers: { "Accept": "application/json" } }, 8000);
        const data = await response.json();
        return Object.values(data.query?.pages || {})
            .map((page) => ({
                title: String(page.title || "").replace(/^File:/, "").replace(/\.[a-z0-9]+$/i, ""),
                thumbUrl: page.imageinfo?.[0]?.thumburl || page.imageinfo?.[0]?.url,
            }))
            .filter((item) => item.thumbUrl);
    } catch {
        return [];
    }
}

function loadCorsImage(url) {
    return new Promise((resolve, reject) => {
        const image = new Image();
        image.crossOrigin = "anonymous";
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error("Referenzbild konnte nicht geladen werden"));
        image.src = url;
    });
}

function imageComparisonSignature(image) {
    const canvas = document.createElement("canvas");
    const maxSide = 96;
    const scale = Math.min(1, maxSide / Math.max(image.naturalWidth || image.width, image.naturalHeight || image.height));
    canvas.width = Math.max(1, Math.round((image.naturalWidth || image.width) * scale));
    canvas.height = Math.max(1, Math.round((image.naturalHeight || image.height) * scale));
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    const stats = regionStats(pixels, canvas.width, canvas.height, 0, 0, 1, 1);
    const edges = edgeProfile(pixels, canvas.width, canvas.height, 0, 0, 1, 1);
    return {
        green: stats.green,
        blue: stats.blue,
        gray: stats.gray,
        warm: stats.warm,
        dark: stats.dark,
        bright: stats.bright,
        luma: stats.luma,
        edge: edges.density,
        vertical: edges.vertical,
        aspect: canvas.height / Math.max(canvas.width, 1),
        hash: perceptualHash(image),
        regions: regionGridSignature(pixels, canvas.width, canvas.height),
    };
}

function safeImageComparisonSignature(image) {
    try {
        return imageComparisonSignature(image);
    } catch {
        return null;
    }
}

function signatureSimilarity(a, b) {
    if (!a || !b) return 0;
    const keys = ["green", "blue", "gray", "warm", "dark", "bright", "luma", "edge", "vertical"];
    const distance = keys.reduce((sum, key) => sum + Math.abs((a[key] || 0) - (b[key] || 0)), 0) / keys.length;
    const globalSimilarity = clamp(1 - distance * 1.35);
    const aspectSimilarity = clamp(1 - Math.min(.45, Math.abs((a.aspect || 1) - (b.aspect || 1)) / 2));
    const hashSimilarity = binaryHashSimilarity(a.hash, b.hash);
    const regionSimilarity = vectorSimilarity(a.regions, b.regions);
    return clamp(globalSimilarity * .22 + hashSimilarity * .30 + regionSimilarity * .38 + aspectSimilarity * .10);
}

function perceptualHash(image) {
    const canvas = document.createElement("canvas");
    canvas.width = 9;
    canvas.height = 8;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    const bits = [];
    for (let y = 0; y < 8; y += 1) {
        for (let x = 0; x < 8; x += 1) {
            bits.push(lumaAt(pixels, canvas.width, x, y) > lumaAt(pixels, canvas.width, x + 1, y) ? 1 : 0);
        }
    }
    return bits;
}

function regionGridSignature(pixels, width, height) {
    const vector = [];
    const cols = 4;
    const rows = 4;
    for (let y = 0; y < rows; y += 1) {
        for (let x = 0; x < cols; x += 1) {
            const stats = regionStats(pixels, width, height, x / cols, y / rows, (x + 1) / cols, (y + 1) / rows);
            vector.push(stats.luma, stats.green, stats.blue, stats.gray, stats.warm);
        }
    }
    return vector;
}

function binaryHashSimilarity(a, b) {
    if (!a?.length || !b?.length) return .5;
    const length = Math.min(a.length, b.length);
    let same = 0;
    for (let i = 0; i < length; i += 1) {
        if (a[i] === b[i]) same += 1;
    }
    return same / length;
}

function vectorSimilarity(a, b) {
    if (!a?.length || !b?.length) return .5;
    const length = Math.min(a.length, b.length);
    let distance = 0;
    for (let i = 0; i < length; i += 1) {
        distance += Math.abs((a[i] || 0) - (b[i] || 0));
    }
    return clamp(1 - distance / length * 1.45);
}

function promiseTimeout(promise, ms) {
    let timer;
    const timeout = new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error("timeout")), ms);
    });
    return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

function focusBestImageLocation(hints) {
    const locationHint = hints
        .filter((hint) => hint.location && hint.location.autofocus !== false && hint.confidence >= .9)
        .sort((a, b) => b.confidence - a.confidence)[0];
    if (!locationHint) return false;
    focusImageLocation(locationHint.location, `Bildhinweis: ${locationHint.label}`);
    return true;
}

function focusImageLocation(location, label) {
    if (!location) return;
    setSearchCenter([location.lat, location.lon], location.zoom || 16);
    state.imageSource.clear();
    const imageFeature = new ol.Feature({
        geometry: new ol.geom.Point(ol.proj.fromLonLat([location.lon, location.lat])),
        popupHtml: `<strong>${escapeHtml(label)}</strong>${location.label ? `<br>${escapeHtml(location.label)}` : ""}`,
    });
    state.imageSource.addFeature(imageFeature);
    openFeaturePopup(imageFeature, imageFeature.get("popupHtml"));
    drawSearchCircle();
}

function analyzeImagePixels(image, gps, fileName) {
    const canvas = document.createElement("canvas");
    const maxSide = 180;
    const scale = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight));
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    const total = pixels.length / 4;
    const counts = { green: 0, blue: 0, gray: 0, warm: 0, dark: 0 };
    for (let i = 0; i < pixels.length; i += 4) {
        const r = pixels[i];
        const g = pixels[i + 1];
        const b = pixels[i + 2];
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        if (g > r * 1.12 && g > b * 1.08) counts.green += 1;
        if (b > r * 1.1 && b > g * 1.02) counts.blue += 1;
        if (max - min < 28 && max > 70) counts.gray += 1;
        if (r > g * 1.08 && g > b * 1.08) counts.warm += 1;
        if (max < 58) counts.dark += 1;
    }
    const ratio = (key) => counts[key] / Math.max(total, 1);
    const hints = [];
    const scene = imageSceneMetrics(pixels, canvas.width, canvas.height);
    hints.push(...visualLandmarkHints(scene, fileName));
    if (gps) hints.push(imageHint("GPS-Koordinaten", "exakte Fotokoordinaten", "transport", .95, []));
    if (ratio("green") > .22) hints.push(imageHint("viel Gruen", "Wald, Park, Wiese, Baeume", "vegetation", ratio("green"), ["forest", "meadow"]));
    if (ratio("blue") > .18) hints.push(imageHint("blaues Wasser/Himmel", "Wasser, Fluss, Bruecke, Ufer", "water", ratio("blue"), ["river", "bridge"]));
    if (ratio("gray") > .28) hints.push(imageHint("graue Flaechen", "Strasse, Wege, Gebaeude, Haltestellen", "transport", ratio("gray"), ["bus_stop"]));
    if (ratio("warm") > .16) hints.push(imageHint("warme Fassaden/Daecher", "Satteldach, Wohngebiet, Fachwerk", "building", ratio("warm"), ["gabled_roof", "half_timbered", "detached"]));
    if (ratio("dark") > .2 && ratio("green") > .14) hints.push(imageHint("dunkle Vegetation", "Waldnaehe, dichter Bewuchs", "vegetation", ratio("dark"), ["forest"]));
    const nameText = normalize(fileName);
    entityCatalog.forEach((item) => {
        if ([item.label, ...item.terms].some((term) => nameText.includes(normalize(term)))) {
            hints.push(imageHint(`Dateiname: ${item.label}`, item.label, item.group, .8, [item.id]));
        }
    });
    return dedupeImageHints(hints);
}

function imageSceneMetrics(pixels, width, height) {
    const towerBand = regionStats(pixels, width, height, .34, .06, .72, .66);
    const upperCenter = regionStats(pixels, width, height, .24, .04, .78, .52);
    const centerSky = regionStats(pixels, width, height, .32, .02, .68, .32);
    const lowerCenter = regionStats(pixels, width, height, .25, .52, .75, .95);
    const bottom = regionStats(pixels, width, height, .05, .62, .95, .98);
    const leftSide = regionStats(pixels, width, height, .00, .12, .30, .86);
    const rightSide = regionStats(pixels, width, height, .70, .12, 1.00, .86);
    const towerCandidate = bestTowerCandidate(pixels, width, height);
    return {
        aspect: height / Math.max(width, 1),
        towerBand,
        towerCandidate,
        upperCenter,
        centerSky,
        lowerCenter,
        bottom,
        leftSide,
        rightSide,
        towerStripes: horizontalStripeScore(pixels, width, height, .36, .08, .70, .62),
        towerEdges: edgeProfile(pixels, width, height, .34, .06, .72, .66),
        bottomEdges: edgeProfile(pixels, width, height, .05, .62, .95, .98),
        sideEdges: edgeProfile(pixels, width, height, .00, .16, 1.00, .86),
    };
}

function bestTowerCandidate(pixels, width, height) {
    const windows = [
        [.28, .48],
        [.34, .54],
        [.40, .60],
        [.46, .66],
        [.52, .72],
        [.34, .66],
        [.42, .74],
    ];
    return windows
        .map(([left, right]) => towerCandidateScore(pixels, width, height, left, right))
        .sort((a, b) => b.score - a.score)[0];
}

function towerCandidateScore(pixels, width, height, left, right) {
    const core = regionStats(pixels, width, height, left, .08, right, .64);
    const leftBack = regionStats(pixels, width, height, Math.max(0, left - .18), .05, left, .58);
    const rightBack = regionStats(pixels, width, height, right, .05, Math.min(1, right + .18), .58);
    const stripes = horizontalStripeScore(pixels, width, height, left, .10, right, .60);
    const edges = edgeProfile(pixels, width, height, left, .08, right, .64);
    const backgroundOpen = clamp((leftBack.bright + leftBack.blue + rightBack.bright + rightBack.blue) / 2);
    const facadePenalty = clamp(core.green * .45 + Math.max(0, core.warm - .38) * .32 + Math.max(0, core.dark - .26) * .20);
    const bodyScore = clamp(core.gray * .34 + stripes * .32 + edges.density * .22 + Math.max(0, edges.vertical - .48) * .28 + backgroundOpen * .16);
    return {
        left,
        right,
        core,
        stripes,
        edges,
        backgroundOpen,
        score: clamp(bodyScore - facadePenalty),
    };
}

function visualLandmarkHints(scene, fileName) {
    const hints = [];
    const name = normalize(fileName);
    const fileAlley = /gasse|wagnergasse|johannisgasse|jenergasse|kopfstein|cobble|paving/.test(name);
    const tower = scene.towerCandidate;
    const genericTowerConfidence = clamp(
        tower.score * .76
        + scene.towerBand.gray * .10
        + scene.towerStripes * .10
        + (scene.aspect > 1.05 ? .04 : 0),
    );
    const stripedHighriseConfidence = clamp(
        genericTowerConfidence * .58
        + tower.stripes * .30
        + tower.core.gray * .12
        + tower.backgroundOpen * .08,
    );
    const sideFacadeScore = clamp(
        (scene.leftSide.warm + scene.leftSide.gray + scene.leftSide.dark * .32
        + scene.rightSide.warm + scene.rightSide.gray + scene.rightSide.dark * .32) / 1.7,
    );
    const skyCorridorScore = clamp(scene.centerSky.bright * .45 + scene.centerSky.blue * .34 + scene.centerSky.gray * .12);
    const groundTextureScore = clamp(scene.bottomEdges.density * .72 + scene.bottomEdges.strength * 1.8 + scene.bottom.gray * .18);
    const alleyConfidence = clamp(
        (fileAlley ? .42 : .08)
        + sideFacadeScore * .34
        + skyCorridorScore * .24
        + groundTextureScore * .44
        + scene.sideEdges.vertical * .12
        + (scene.aspect > 1.08 ? .07 : 0),
    );
    const cobblestoneConfidence = clamp((fileAlley ? .32 : .04) + groundTextureScore * .74 + scene.bottom.gray * .18 + scene.bottom.warm * .12);
    const outdoorSeatingConfidence = clamp(
        (alleyConfidence > .48 ? .18 : 0)
        + scene.lowerCenter.warm * .48
        + scene.bottom.warm * .32
        + scene.bottomEdges.density * .18,
    );
    const urbanStreetConfidence = clamp(sideFacadeScore * .34 + groundTextureScore * .24 + scene.bottom.gray * .18 + scene.sideEdges.density * .20);
    const waterfrontConfidence = clamp(scene.lowerCenter.blue * .48 + scene.bottom.blue * .42 + scene.centerSky.blue * .12 + scene.lowerCenter.bright * .08);
    const greenPlaceConfidence = clamp(scene.bottom.green * .32 + scene.leftSide.green * .22 + scene.rightSide.green * .22 + scene.lowerCenter.green * .20);
    const mediterraneanConfidence = clamp(scene.leftSide.warm * .25 + scene.rightSide.warm * .25 + scene.bottom.bright * .10 + scene.centerSky.bright * .12 - scene.bottom.green * .12);

    if (stripedHighriseConfidence > .62 && tower.core.green < .24) {
        hints.push(imageHint("gestreiftes Hochhaus/Turm", "Hochhaus, Turm, Glasfassade, gestreifte Fassade, markantes Gebaeude", "building", stripedHighriseConfidence, ["tower_building", "viewpoint"]));
    } else if (genericTowerConfidence > .54 && tower.core.green < .28) {
        hints.push(imageHint("Hochhaus/Turm-Silhouette", "Hochhaus, Turm, markantes Gebaeude, Aussichtspunkt", "building", genericTowerConfidence, ["tower_building", "viewpoint"]));
    }
    if (urbanStreetConfidence > .50) {
        hints.push(imageHint("urbane Strassenszene", "Stadtzentrum, Strasse, Gebaeude, POIs, Haltestellen", "transport", urbanStreetConfidence, ["road_reference", "traffic_signal", "bus_stop"]));
    }
    if (alleyConfidence > .48 && (fileAlley || groundTextureScore > .20 || sideFacadeScore > .22)) {
        hints.push(imageHint("Altstadtgasse / enge Gasse", "Gasse, Altstadtgasse, schmale Strasse, Altstadt", "transport", alleyConfidence, ["alley"]));
    }
    if (cobblestoneConfidence > .46) {
        hints.push(imageHint("Kopfsteinpflaster", "Kopfsteinpflaster, Pflastersteine, cobblestone, paving stones", "transport", cobblestoneConfidence, ["cobblestone"]));
    }
    if (outdoorSeatingConfidence > .42) {
        hints.push(imageHint("Aussengastronomie", "Aussengastronomie, Strassencafe, Restaurant, Cafe, outdoor seating", "poi", outdoorSeatingConfidence, ["outdoor_seating", "restaurant", "cafe"]));
    }
    if (waterfrontConfidence > .34) {
        hints.push(imageHint("Wasser- oder Kuestennaehe", "Wasser, Fluss, See, Kueste, Bruecke, Ufer", "water", waterfrontConfidence, ["river", "bridge"]));
    }
    if (greenPlaceConfidence > .30) {
        hints.push(imageHint("starker Gruenanteil", "Park, Wald, Wiese, Baumreihen, Gruenflaechen", "vegetation", greenPlaceConfidence, ["forest", "meadow"]));
    }
    if (mediterraneanConfidence > .46 && sideFacadeScore > .18) {
        hints.push(imageHint("helle warme Fassaden", "Altstadt, warme Fassaden, Satteldach, historische Gebaeude", "building", mediterraneanConfidence, ["gabled_roof", "historic", "half_timbered"]));
    }
    if (stripedHighriseConfidence > .62 && alleyConfidence > .48) {
        hints.push(imageHint("Stadtgasse mit markantem Turm", "Altstadtgasse, Hochhaus, Turm, Kopfsteinpflaster, Aussengastronomie", "building", clamp((stripedHighriseConfidence + alleyConfidence) / 2 + .08), ["tower_building", "alley", "cobblestone", "outdoor_seating"]));
    }
    return hints;
}

function regionStats(pixels, width, height, left, top, right, bottom) {
    const x0 = Math.max(0, Math.floor(width * left));
    const y0 = Math.max(0, Math.floor(height * top));
    const x1 = Math.min(width, Math.ceil(width * right));
    const y1 = Math.min(height, Math.ceil(height * bottom));
    const totals = { count: 0, green: 0, blue: 0, gray: 0, warm: 0, dark: 0, bright: 0, luma: 0 };
    for (let y = y0; y < y1; y += 1) {
        for (let x = x0; x < x1; x += 1) {
            const index = (y * width + x) * 4;
            const r = pixels[index];
            const g = pixels[index + 1];
            const b = pixels[index + 2];
            const max = Math.max(r, g, b);
            const min = Math.min(r, g, b);
            const lum = pixelLuma(r, g, b);
            totals.count += 1;
            totals.luma += lum;
            if (g > r * 1.12 && g > b * 1.08) totals.green += 1;
            if (b > r * 1.1 && b > g * 1.02) totals.blue += 1;
            if (max - min < 32 && max > 62) totals.gray += 1;
            if (r > g * 1.04 && g > b * 1.02) totals.warm += 1;
            if (max < 58) totals.dark += 1;
            if (max > 185 && lum > 148) totals.bright += 1;
        }
    }
    const count = Math.max(totals.count, 1);
    return {
        green: totals.green / count,
        blue: totals.blue / count,
        gray: totals.gray / count,
        warm: totals.warm / count,
        dark: totals.dark / count,
        bright: totals.bright / count,
        luma: totals.luma / count / 255,
    };
}

function edgeProfile(pixels, width, height, left, top, right, bottom) {
    const x0 = Math.max(1, Math.floor(width * left));
    const y0 = Math.max(1, Math.floor(height * top));
    const x1 = Math.min(width - 1, Math.ceil(width * right));
    const y1 = Math.min(height - 1, Math.ceil(height * bottom));
    let count = 0;
    let strong = 0;
    let dxTotal = 0;
    let dyTotal = 0;
    for (let y = y0; y < y1; y += 2) {
        for (let x = x0; x < x1; x += 2) {
            const dx = Math.abs(lumaAt(pixels, width, x + 1, y) - lumaAt(pixels, width, x - 1, y));
            const dy = Math.abs(lumaAt(pixels, width, x, y + 1) - lumaAt(pixels, width, x, y - 1));
            dxTotal += dx;
            dyTotal += dy;
            if (dx + dy > 42) strong += 1;
            count += 1;
        }
    }
    const total = Math.max(dxTotal + dyTotal, 1);
    return {
        density: strong / Math.max(count, 1),
        vertical: dxTotal / total,
        horizontal: dyTotal / total,
        strength: total / Math.max(count * 510, 1),
    };
}

function horizontalStripeScore(pixels, width, height, left, top, right, bottom) {
    const x0 = Math.max(0, Math.floor(width * left));
    const y0 = Math.max(0, Math.floor(height * top));
    const x1 = Math.min(width, Math.ceil(width * right));
    const y1 = Math.min(height, Math.ceil(height * bottom));
    const rows = [];
    for (let y = y0; y < y1; y += 2) {
        let sum = 0;
        let count = 0;
        for (let x = x0; x < x1; x += 2) {
            sum += lumaAt(pixels, width, x, y);
            count += 1;
        }
        rows.push(sum / Math.max(count, 1));
    }
    if (rows.length < 4) return 0;
    const diffs = rows.slice(1).map((value, index) => Math.abs(value - rows[index]));
    const avgDiff = diffs.reduce((sum, value) => sum + value, 0) / Math.max(diffs.length, 1) / 255;
    const sharpRows = diffs.filter((value) => value > 10).length / Math.max(diffs.length, 1);
    return clamp((avgDiff - .01) * 7 + sharpRows * .34);
}

function lumaAt(pixels, width, x, y) {
    const index = (y * width + x) * 4;
    return pixelLuma(pixels[index], pixels[index + 1], pixels[index + 2]);
}

function pixelLuma(r, g, b) {
    return r * .2126 + g * .7152 + b * .0722;
}

function dedupeImageHints(hints) {
    const seen = new Set();
    return hints
        .filter((hint) => {
            const key = `${hint.label}:${hint.query}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        })
        .sort((a, b) => b.confidence - a.confidence)
        .slice(0, 12);
}

function imageHint(label, query, group, confidence, entityIds = [], location = null) {
    return { label, query, group, confidence: clamp(confidence), entityIds, location };
}

function renderImageSignals(hints, gps) {
    const box = $("#imageSignals");
    box.innerHTML = "";
    if (!hints.length) {
        const empty = document.createElement("div");
        empty.className = "signal";
        empty.innerHTML = "<span>keine stabilen Hinweise</span><strong>0%</strong>";
        box.appendChild(empty);
        return;
    }
    hints.forEach((hint) => {
        const row = document.createElement("div");
        row.className = "signal";
        row.innerHTML = `<span>${escapeHtml(hint.label)}</span><strong>${Math.round(hint.confidence * 100)}%</strong>`;
        box.appendChild(row);
    });
    if (gps) {
        const row = document.createElement("div");
        row.className = "signal";
        row.innerHTML = `<span>${gps.lat.toFixed(5)}, ${gps.lon.toFixed(5)}</span><strong>GPS</strong>`;
        box.appendChild(row);
    }
}

function applyImageHintsToQuery() {
    if (!state.imageHints.length) {
        setStatus("Noch keine Bildhinweise vorhanden.");
        return;
    }
    const queryText = state.imageHints.map((hint) => hint.query).filter(Boolean).join(", ");
    const input = $("#queryInput");
    input.value = appendUniqueText(input.value, queryText);
    state.imageHints.flatMap((hint) => hint.entityIds).forEach((id) => state.selectedEntities.add(id));
    syncEntityQueryText();
    renderEntityCatalog();
    renderSelectedEntities();
    focusBestImageLocation(state.imageHints);
    setStatus("Bildhinweise wurden in Query und Entitaeten uebernommen.");
}

function appendUniqueText(current, addition) {
    if (!addition) return current;
    const normalizedCurrent = normalize(current);
    const parts = addition.split(",").map((part) => part.trim()).filter(Boolean);
    const missing = parts.filter((part) => !normalizedCurrent.includes(normalize(part)));
    return missing.length ? `${current.trim()}${current.trim() ? ", " : ""}${missing.join(", ")}` : current;
}

function extractGpsFromExif(buffer) {
    try {
        const view = new DataView(buffer);
        if (view.byteLength < 12 || view.getUint16(0, false) !== 0xffd8) return null;
        let offset = 2;
        while (offset + 4 < view.byteLength) {
            if (view.getUint8(offset) !== 0xff) return null;
            const marker = view.getUint8(offset + 1);
            const size = view.getUint16(offset + 2, false);
            if (marker === 0xe1 && readAscii(view, offset + 4, 6) === "Exif\0\0") {
                const tiffOffset = offset + 10;
                const endian = view.getUint16(tiffOffset, false);
                const little = endian === 0x4949;
                if (!little && endian !== 0x4d4d) return null;
                const firstIfdOffset = tiffOffset + view.getUint32(tiffOffset + 4, little);
                const ifd0 = readIfdEntries(view, tiffOffset, firstIfdOffset, little);
                const gpsPointer = ifd0.get(0x8825);
                if (!gpsPointer?.value) return null;
                const gpsIfd = readIfdEntries(view, tiffOffset, tiffOffset + gpsPointer.value, little);
                const lat = gpsCoordinate(view, gpsIfd.get(0x0002), asciiTag(view, gpsIfd.get(0x0001)), little);
                const lon = gpsCoordinate(view, gpsIfd.get(0x0004), asciiTag(view, gpsIfd.get(0x0003)), little);
                return Number.isFinite(lat) && Number.isFinite(lon) ? { lat, lon } : null;
            }
            offset += 2 + size;
        }
    } catch {
        return null;
    }
    return null;
}

function readIfdEntries(view, tiffOffset, ifdOffset, little) {
    const entries = new Map();
    const count = view.getUint16(ifdOffset, little);
    for (let i = 0; i < count; i += 1) {
        const entryOffset = ifdOffset + 2 + i * 12;
        const tag = view.getUint16(entryOffset, little);
        const type = view.getUint16(entryOffset + 2, little);
        const entryCount = view.getUint32(entryOffset + 4, little);
        const valueOffset = view.getUint32(entryOffset + 8, little);
        const bytes = typeByteSize(type) * entryCount;
        entries.set(tag, {
            type,
            count: entryCount,
            value: type === 4 && entryCount === 1 ? valueOffset : null,
            dataOffset: bytes <= 4 ? entryOffset + 8 : tiffOffset + valueOffset,
        });
    }
    return entries;
}

function typeByteSize(type) {
    return { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8 }[type] || 1;
}

function asciiTag(view, entry) {
    if (!entry) return "";
    return readAscii(view, entry.dataOffset, entry.count).replace(/\0/g, "");
}

function gpsCoordinate(view, entry, ref, little) {
    if (!entry || entry.type !== 5 || entry.count < 3) return null;
    const parts = [];
    for (let i = 0; i < 3; i += 1) {
        const offset = entry.dataOffset + i * 8;
        const numerator = view.getUint32(offset, little);
        const denominator = view.getUint32(offset + 4, little) || 1;
        parts.push(numerator / denominator);
    }
    const value = parts[0] + parts[1] / 60 + parts[2] / 3600;
    return ref === "S" || ref === "W" ? -value : value;
}

function readAscii(view, offset, length) {
    let output = "";
    for (let i = 0; i < length && offset + i < view.byteLength; i += 1) {
        output += String.fromCharCode(view.getUint8(offset + i));
    }
    return output;
}

async function importReviewFile(event) {
    const file = event.target.files[0];
    if (!file) return;
    const text = await file.text();
    try {
        const reviews = file.name.toLowerCase().endsWith(".csv") ? parseReviewCsv(text) : parseReviewJson(JSON.parse(text));
        state.reviewRecords = reviews;
        renderReviewSummary();
        setStatus(`${reviews.length} Review-Datensaetze geladen.`);
        if (state.results.length) {
            const query = parseQuery($("#queryInput").value, selectedSources());
            state.results = scoreFeatures(state.results, query).sort((a, b) => b.score - a.score);
            renderResults(state.results, query);
        }
    } catch (error) {
        setStatus(`Review-Import fehlgeschlagen: ${error.message}`);
    }
}

function parseReviewJson(data) {
    const rows = Array.isArray(data) ? data : data.features || [];
    return rows.map((row, index) => {
        const props = row.properties || row;
        const coords = row.geometry?.type === "Point" ? row.geometry.coordinates : null;
        return normalizeReviewRecord({
            name: props.name || props.title,
            source: props.source || props.platform || "Review",
            rating: props.rating || props.stars || props.score,
            count: props.count || props.reviews || props.review_count,
            url: props.url || props.link,
            text: props.text || props.review,
            lat: props.lat || props.latitude || coords?.[1],
            lon: props.lon || props.lng || props.longitude || coords?.[0],
        }, index);
    }).filter(Boolean);
}

function parseReviewCsv(text) {
    const rows = parseCsvRows(text);
    const header = rows.shift()?.map((cell) => normalize(cell)) || [];
    return rows.map((row, index) => {
        const get = (...names) => {
            const target = names.map(normalize);
            const found = header.findIndex((item) => target.includes(item));
            return found >= 0 ? row[found] : "";
        };
        return normalizeReviewRecord({
            name: get("name", "title", "restaurant"),
            source: get("source", "platform", "map"),
            rating: get("rating", "stars", "score"),
            count: get("count", "reviews", "review_count"),
            url: get("url", "link"),
            text: get("text", "review"),
            lat: get("lat", "latitude"),
            lon: get("lon", "lng", "longitude"),
        }, index);
    }).filter(Boolean);
}

function normalizeReviewRecord(raw, index) {
    const rating = Number(String(raw.rating || "").replace(",", "."));
    const lat = Number(String(raw.lat || "").replace(",", "."));
    const lon = Number(String(raw.lon || "").replace(",", "."));
    if (!raw.name && (!Number.isFinite(lat) || !Number.isFinite(lon))) return null;
    return {
        id: `review-${index}`,
        name: raw.name || `Review ${index + 1}`,
        source: raw.source || "Review",
        rating: Number.isFinite(rating) ? rating : null,
        count: Number(raw.count) || null,
        url: raw.url || "",
        text: raw.text || "",
        lat: Number.isFinite(lat) ? lat : null,
        lon: Number.isFinite(lon) ? lon : null,
    };
}

function parseCsvRows(text) {
    const rows = [];
    let row = [];
    let cell = "";
    let quoted = false;
    const delimiter = guessCsvDelimiter(text);
    for (let i = 0; i < text.length; i += 1) {
        const char = text[i];
        const next = text[i + 1];
        if (char === '"' && quoted && next === '"') {
            cell += '"';
            i += 1;
        } else if (char === '"') {
            quoted = !quoted;
        } else if (char === delimiter && !quoted) {
            row.push(cell.trim());
            cell = "";
        } else if ((char === "\n" || char === "\r") && !quoted) {
            if (char === "\r" && next === "\n") i += 1;
            row.push(cell.trim());
            if (row.some(Boolean)) rows.push(row);
            row = [];
            cell = "";
        } else {
            cell += char;
        }
    }
    row.push(cell.trim());
    if (row.some(Boolean)) rows.push(row);
    return rows;
}

function guessCsvDelimiter(text) {
    const firstLine = text.split(/\r?\n/, 1)[0] || "";
    const semicolons = (firstLine.match(/;/g) || []).length;
    const commas = (firstLine.match(/,/g) || []).length;
    return semicolons > commas ? ";" : ",";
}

function renderReviewSummary() {
    const box = $("#reviewSummary");
    const sources = [...new Set(state.reviewRecords.map((review) => review.source))];
    box.textContent = `${state.reviewRecords.length} Review-Datensaetze${sources.length ? ` aus ${sources.join(", ")}` : ""}`;
}

function findReviewsForFeature(feature) {
    const featureName = normalize(feature.name);
    return state.reviewRecords.filter((review) => {
        const reviewName = normalize(review.name);
        const nameMatch = featureName && reviewName && (featureName === reviewName || featureName.includes(reviewName) || reviewName.includes(featureName));
        const geoMatch = Number.isFinite(review.lat) && Number.isFinite(review.lon) && distanceMeters(feature.lat, feature.lon, review.lat, review.lon) <= 90;
        return nameMatch || geoMatch;
    });
}

function reviewConfidence(reviews) {
    if (!reviews.length) return 0;
    return clamp((averageRating(reviews) || 0) / 5);
}

function averageRating(reviews) {
    const values = reviews.map((review) => review.rating).filter((rating) => Number.isFinite(rating));
    return values.length ? values.reduce((sum, rating) => sum + rating, 0) / values.length : 0;
}

function reviewsHtml(result) {
    if (!result.reviews?.length) return "";
    const rows = result.reviews.slice(0, 4).map((review) => {
        const rating = Number.isFinite(review.rating) ? `${review.rating.toFixed(1)}/5` : "ohne Rating";
        const count = review.count ? ` (${review.count})` : "";
        const label = `${review.source}: ${rating}${count}`;
        return review.url
            ? `<a class="review-pill" href="${escapeHtml(review.url)}" target="_blank" rel="noopener">${escapeHtml(label)}</a>`
            : `<span class="review-pill">${escapeHtml(label)}</span>`;
    }).join("");
    return `<div class="review-stack"><div class="review-row">${rows}</div></div>`;
}

function externalLinksHtml(result) {
    if (!isFoodPlace(result)) return "";
    const q = encodeURIComponent(`${result.name} ${state.center[0].toFixed(4)},${state.center[1].toFixed(4)}`);
    const lat = encodeURIComponent(result.lat);
    const lon = encodeURIComponent(result.lon);
    return `<div class="external-links">
        <a class="external-link" href="https://www.google.com/maps/search/?api=1&query=${q}" target="_blank" rel="noopener">Google Maps</a>
        <a class="external-link" href="https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=18/${lat}/${lon}" target="_blank" rel="noopener">OSM</a>
        <a class="external-link" href="https://www.tripadvisor.com/Search?q=${q}" target="_blank" rel="noopener">Tripadvisor</a>
    </div>`;
}

function isFoodPlace(result) {
    return ["restaurant", "cafe", "fast_food", "bar", "pub"].includes(result.tags.amenity) || Boolean(result.tags.cuisine);
}

async function importFile(event) {
    const file = event.target.files[0];
    if (!file) return;
    const text = await file.text();
    try {
        const features = file.name.toLowerCase().endsWith(".csv") ? parseCsv(text) : parseGeoJson(JSON.parse(text));
        state.importedFeatures = features;
        refreshDynamicEntities(features);
        setStatus(`${features.length} importierte Punkte aus ${file.name} geladen.`);
    } catch (error) {
        setStatus(`Import fehlgeschlagen: ${error.message}`);
    }
}

function parseGeoJson(data) {
    const features = data.type === "FeatureCollection" ? data.features : [data];
    return features.map((feature, index) => {
        const coords = coordinatesFromGeometry(feature.geometry || feature);
        if (!coords) return null;
        const props = feature.properties || {};
        return {
            id: `import-${index}-${coords[0]}-${coords[1]}`,
            source: "Import",
            lat: coords[1],
            lon: coords[0],
            name: props.name || props.title || `Importpunkt ${index + 1}`,
            tags: props,
        };
    }).filter(Boolean);
}

function coordinatesFromGeometry(geometry) {
    if (!geometry) return null;
    if (geometry.type === "Point") return geometry.coordinates;
    if (geometry.type === "Polygon") return geometry.coordinates?.[0]?.[0] || null;
    if (geometry.type === "LineString") return geometry.coordinates?.[0] || null;
    if (geometry.type === "MultiPolygon") return geometry.coordinates?.[0]?.[0]?.[0] || null;
    return null;
}

function parseCsv(text) {
    const rows = text.trim().split(/\r?\n/).map((line) => line.split(",").map((cell) => cell.trim()));
    const header = rows.shift().map((cell) => cell.toLowerCase());
    const latIndex = header.findIndex((cell) => ["lat", "latitude", "breite"].includes(cell));
    const lonIndex = header.findIndex((cell) => ["lon", "lng", "longitude", "laenge", "länge"].includes(cell));
    if (latIndex < 0 || lonIndex < 0) throw new Error("CSV braucht lat/lon oder latitude/longitude Spalten.");
    return rows.map((row, index) => {
        const tags = Object.fromEntries(header.map((key, column) => [key, row[column] || ""]));
        return {
            id: `csv-${index}`,
            source: "CSV",
            lat: Number(row[latIndex]),
            lon: Number(row[lonIndex]),
            name: tags.name || tags.title || `CSV-Punkt ${index + 1}`,
            tags,
        };
    }).filter((feature) => Number.isFinite(feature.lat) && Number.isFinite(feature.lon));
}

function exportGeoJson() {
    const geojson = {
        type: "FeatureCollection",
        features: state.results.map((result) => ({
            type: "Feature",
            properties: {
                name: result.name,
                score: result.score,
                source: result.source,
                ...result.tags,
            },
            geometry: {
                type: "Point",
                coordinates: [result.lon, result.lat],
            },
        })),
    };
    const blob = new Blob([JSON.stringify(geojson, null, 2)], { type: "application/geo+json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "gvis-ergebnisse.geojson";
    link.click();
    URL.revokeObjectURL(url);
}

function distanceMeters(lat1, lon1, lat2, lon2) {
    const earthRadius = 6371000;
    const toRad = (degree) => degree * Math.PI / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    return 2 * earthRadius * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function normalize(value) {
    return String(value || "")
        .toLowerCase()
        .replaceAll("ä", "ae")
        .replaceAll("ö", "oe")
        .replaceAll("ü", "ue")
        .replaceAll("ß", "ss");
}

function clamp(value) {
    return Math.max(0, Math.min(1, value));
}

function escapeHtml(value) {
    return String(value || "").replace(/[&<>"']/g, (char) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
    }[char]));
}

init();
