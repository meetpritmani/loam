/**
 * demo-data.mjs — the Fernway catalogue and content, in one place.
 *
 * This file is the single source of truth for three separate outputs:
 *
 *   - what 3-seed-catalog.mjs creates in the demo store
 *   - what 4-seed-content.mjs creates in the demo store
 *   - what lands in demo-store-export/ for the buyer
 *
 * They have to agree. A products.csv hand-maintained alongside a seeding
 * script drifts within a week, and the buyer's store then looks different
 * from the screenshots that sold them the theme.
 *
 * All copy is original Fernway copy from CLAUDE.md §11. Voice: plain,
 * confident, material-first. Short sentences. No exclamation marks.
 *
 * Prices are in the store's own currency, as major units (strings, because
 * that is what Shopify's API takes and what avoids float rounding).
 */

/* --------------------------------------------------------------------------
   Options
   -------------------------------------------------------------------------- */

const MENS_SIZES = ['US 7', 'US 8', 'US 9', 'US 10', 'US 11', 'US 12', 'US 13'];
const WOMENS_SIZES = ['US 5', 'US 6', 'US 7', 'US 8', 'US 9', 'US 10', 'US 11'];

/* --------------------------------------------------------------------------
   Products (§11 copy bible, §12.4 structure)
   -------------------------------------------------------------------------- */

/**
 * Eight products. Between them they have to produce every state the theme
 * renders, because a demo store that only shows the happy path hides exactly
 * the cases a buyer wants to inspect:
 *
 *   - two tagged `new`          -> the New badge
 *   - one with a compareAtPrice -> the sale badge and the strikethrough
 *   - a handful of zero-stock variants -> sold-out states in the picker
 *   - `active` / `lounge` tags  -> the two smart collections
 *
 * Every product carries two images. `demo-product-N-alt.webp` is not
 * decoration: card-product's hover swap reads `media[1]`, so a product with
 * one image silently loses that behaviour.
 */
export const PRODUCTS = [
  {
    handle: 'coastline-runner',
    title: 'Coastline Runner',
    type: 'Sneakers',
    price: '128.00',
    tags: ['new', 'active'],
    sizes: MENS_SIZES,
    colours: ['Shell', 'Slate', 'Moss'],
    material: 'Merino wool upper, sugarcane foam sole',
    care: 'Machine wash cold on a gentle cycle. Remove the insoles first. Air dry away from direct heat.',
    description: [
      '<p>A road runner with a merino upper that holds its shape through a wet mile and dries out by morning. The sugarcane foam underfoot is springy at mile one and still springy at mile five hundred.</p>',
      '<ul><li>Merino wool upper, machine washable</li><li>Sugarcane foam midsole</li><li>Weighs 232g in a US 9</li></ul>',
    ].join(''),
    soldOutVariants: [{ colour: 'Moss', size: 'US 12' }],
  },
  {
    handle: 'ridge-lounger',
    title: 'Ridge Lounger',
    type: 'Loungers',
    price: '98.00',
    tags: ['lounge'],
    sizes: WOMENS_SIZES,
    colours: ['Oat', 'Charcoal', 'Clay'],
    material: 'Merino wool upper and lining',
    care: 'Spot clean with cool water. Machine wash cold on a gentle cycle when it needs more than that.',
    description: [
      '<p>A wool slipper that holds up outdoors. Merino inside and out, so it regulates temperature instead of turning your feet into a sauna after twenty minutes.</p>',
      '<ul><li>Merino wool upper and lining</li><li>Sugarcane foam sole, rubber outsole pods</li><li>Collapses at the heel to wear as a slide</li></ul>',
    ].join(''),
    soldOutVariants: [{ colour: 'Clay', size: 'US 5' }],
  },
  {
    handle: 'harbour-slip-on',
    title: 'Harbour Slip-On',
    type: 'Slip-Ons',
    price: '92.00',
    tags: ['lounge'],
    sizes: WOMENS_SIZES,
    colours: ['Chalk', 'Ink', 'Sand'],
    material: 'Eucalyptus fibre knit upper',
    care: 'Machine wash cold on a gentle cycle. Air dry. Do not tumble dry.',
    description: [
      '<p>The one to keep by the door. Eucalyptus knit breathes in humid heat and the whole shoe goes in the machine when it stops looking new.</p>',
      '<ul><li>Eucalyptus fibre knit upper</li><li>No laces, no hardware</li><li>Machine washable end to end</li></ul>',
    ].join(''),
    soldOutVariants: [],
  },
  {
    handle: 'meadow-low',
    title: 'Meadow Low',
    type: 'Sneakers',
    price: '78.00',
    compareAtPrice: '98.00',
    tags: [],
    sizes: MENS_SIZES,
    colours: ['Bone', 'Fern', 'Storm', 'Rust'],
    material: 'Eucalyptus fibre knit upper',
    care: 'Machine wash cold. Air dry away from direct heat.',
    description: [
      '<p>The plainest shoe we make, and the one that gets worn most. A low eucalyptus knit that goes with everything and disappears on the foot.</p>',
      '<ul><li>Eucalyptus fibre knit upper</li><li>Sugarcane foam sole</li><li>Four colourways, one silhouette</li></ul>',
    ].join(''),
    soldOutVariants: [{ colour: 'Rust', size: 'US 8' }],
  },
  {
    handle: 'fernway-trail-mid',
    title: 'Fernway Trail Mid',
    type: 'Sneakers',
    price: '145.00',
    tags: ['new', 'active'],
    sizes: MENS_SIZES,
    colours: ['Moss', 'Basalt', 'Dune'],
    material: 'Merino wool upper, rubber outsole',
    care: 'Brush off dry mud before washing. Machine wash cold on a gentle cycle, laces out.',
    description: [
      '<p>A mid-height trail shoe for weather you did not plan for. Merino over a lugged rubber outsole, cut high enough to keep the scree out.</p>',
      '<ul><li>Merino wool upper with a reinforced toe</li><li>4mm lugged rubber outsole</li><li>Weighs 318g in a US 9</li></ul>',
    ].join(''),
    soldOutVariants: [{ colour: 'Dune', size: 'US 13' }],
  },
  {
    handle: 'drift-knit',
    title: 'Drift Knit',
    type: 'Sneakers',
    price: '108.00',
    tags: ['active'],
    sizes: WOMENS_SIZES,
    colours: ['Mist', 'Pitch', 'Sorrel'],
    material: 'Eucalyptus fibre knit upper, sugarcane foam sole',
    care: 'Machine wash cold on a gentle cycle. Reshape while damp and air dry.',
    description: [
      '<p>A knit trainer with enough structure to walk all day in. The upper is one piece, so there are no seams to rub and nothing to come unstuck.</p>',
      '<ul><li>Seamless eucalyptus fibre knit</li><li>Sugarcane foam sole</li><li>Wide toe box</li></ul>',
    ].join(''),
    soldOutVariants: [],
  },
  {
    handle: 'bracken-boot',
    title: 'Bracken Boot',
    type: 'Boots',
    price: '138.00',
    tags: [],
    sizes: MENS_SIZES,
    colours: ['Bark', 'Slate'],
    material: 'Merino wool upper, water-repellent finish',
    care: 'Wipe down after wet weather. Machine wash cold when it needs it, then reproof.',
    description: [
      '<p>A winter boot that does not weigh anything. Merino with a water-repellent finish over a foam sole, so it stays warm without the bulk that usually comes with it.</p>',
      '<ul><li>Merino wool upper, water-repellent finish</li><li>Sugarcane foam sole with a rubber tread</li><li>Fits over a thick sock without changing size</li></ul>',
    ].join(''),
    soldOutVariants: [{ colour: 'Slate', size: 'US 7' }],
  },
  {
    handle: 'tideline-sandal',
    title: 'Tideline Sandal',
    type: 'Sandals',
    price: '82.00',
    tags: ['lounge'],
    sizes: WOMENS_SIZES,
    colours: ['Shell', 'Kelp', 'Ash'],
    material: 'Sugarcane foam footbed and strap',
    care: 'Rinse with fresh water after the beach. Air dry.',
    description: [
      '<p>One piece of sugarcane foam, moulded. It floats, it does not mind salt water, and there is nothing on it to break.</p>',
      '<ul><li>Sugarcane foam throughout</li><li>Contoured footbed</li><li>Rinses clean</li></ul>',
    ].join(''),
    soldOutVariants: [],
  },
];

/* --------------------------------------------------------------------------
   Collections (§12.4)
   -------------------------------------------------------------------------- */

/**
 * `mens` and `womens` are manual because there is no tag that reliably splits
 * them — the size run does, and a smart collection cannot read a size run.
 * The rest are smart, so a merchant adding a product with the right tag gets
 * it filed automatically.
 *
 * The homepage points `featured-collection` at `best-sellers` and
 * `new-arrivals`. Both must be non-empty or the homepage renders a demo
 * fallback instead of real products.
 */
export const COLLECTIONS = [
  {
    handle: 'mens',
    title: "Men's",
    description: 'Everyday shoes cut on the wider last, in a US 7 to 13 run.',
    image: 'demo-collection-mens.webp',
    type: 'manual',
    productHandles: ['coastline-runner', 'meadow-low', 'fernway-trail-mid', 'bracken-boot'],
  },
  {
    handle: 'womens',
    title: "Women's",
    description: 'The full range in a US 5 to 11 run.',
    image: 'demo-collection-womens.webp',
    type: 'manual',
    productHandles: ['ridge-lounger', 'harbour-slip-on', 'drift-knit', 'tideline-sandal'],
  },
  {
    handle: 'active',
    title: 'Active',
    description: 'Built for miles. Merino and knit uppers over sugarcane foam.',
    image: 'demo-collection-active.webp',
    type: 'smart',
    tag: 'active',
  },
  {
    handle: 'lounge',
    title: 'Lounge',
    description: 'Wool loungers, slip-ons and sandals for the hours off your feet.',
    image: 'demo-collection-lounge.webp',
    type: 'smart',
    tag: 'lounge',
  },
  {
    handle: 'new-arrivals',
    title: 'New arrivals',
    description: 'The most recent additions to the range.',
    image: null,
    type: 'smart',
    tag: 'new',
  },
  {
    handle: 'best-sellers',
    title: 'Best sellers',
    description: 'What people come back for.',
    image: null,
    type: 'manual',
    productHandles: PRODUCTS.map((product) => product.handle),
  },
];

/* --------------------------------------------------------------------------
   Metafield definitions
   -------------------------------------------------------------------------- */

/**
 * As of the 2026-09-10 resubmission fixes (T5/T6), the theme reads exactly
 * one metafield: `descriptors.care_guide`, the care accordion's content
 * source. material, size_guide, and carbon_footprint used to be custom
 * metafields here, but the theme no longer reads any of them —
 * card-product/main-product's material tag is now a merchant-editable block
 * setting (with a dynamic-source icon a merchant can point at their own
 * metafield, if they want, but the demo store deliberately does not use it —
 * binding the demo to a metafield source would make its install state
 * diverge from every other buyer's, and §18 requires preset parity), the
 * size guide reads a `page` block setting, and the carbon footprint feature
 * was removed outright.
 *
 * `descriptors.care_guide` is a Shopify *standard* metafield definition
 * (namespace `descriptors`, key `care_guide`, `multi_line_text_field`, 500
 * char max, defined for both PRODUCT and PRODUCTVARIANT — the theme only
 * reads the PRODUCT one), not a custom one — see `standard: true` below.
 * Enabling a standard definition is a different mutation
 * (`standardMetafieldDefinitionEnable`) from creating a custom one
 * (`metafieldDefinitionCreate`); 3-seed-catalog.mjs branches on this flag to
 * call the right one. `pin: true` so the merchant sees the field in admin
 * without hunting.
 */
export const METAFIELD_DEFINITIONS = [
  {
    namespace: 'descriptors',
    key: 'care_guide',
    name: 'Care instructions',
    description: 'Fills the Care row of the product page accordion.',
    type: 'multi_line_text_field',
    ownerType: 'PRODUCT',
    standard: true,
  },
];

/* --------------------------------------------------------------------------
   Pages (§12.5)
   -------------------------------------------------------------------------- */

export const PAGES = [
  {
    handle: 'about',
    title: 'About',
    body: [
      '<p>Fernway started with a complaint. Every shoe we owned was made of plastic, wore out in a season, and took a few hundred years to go away afterwards.</p>',
      '<p>So we started with the materials instead of the silhouette. Merino wool for the uppers, because it regulates temperature and resists odour without a chemical finish. Eucalyptus fibre for the knits, because it uses a fraction of the water cotton does. Sugarcane foam for the soles, because it is carbon negative before it is anything else.</p>',
      '<p>Three materials. That is the whole shoe. Everything we make is built from some combination of them, which keeps the range small and keeps us honest about what is in it.</p>',
      '<p>Every product page lists exactly what a pair is made of — no blend you cannot picture, no material we would rather not name. If you want the long version of why each one is in there, the materials page has it.</p>',
    ].join(''),
  },
  {
    handle: 'materials',
    title: 'Materials',
    body: [
      '<h2>Merino wool</h2>',
      '<p>Regulates temperature, resists odour, and needs washing about a third as often as cotton. It comes from farms in New Zealand that we audit for mulesing, which we do not permit.</p>',
      '<h2>Eucalyptus fibre</h2>',
      '<p>Uses 95% less water than conventional cotton knit and breathes in humid heat. The pulp comes from FSC-certified forests and the solvent used to spin it is recovered in a closed loop.</p>',
      '<h2>Sugarcane foam</h2>',
      '<p>A carbon-negative sole that stays springy past 500 miles. The cane is rain-fed, and the foam captures more carbon while it grows than the processing releases.</p>',
      '<p>That is the entire materials list. If something is not on this page, it is not in the shoe.</p>',
    ].join(''),
  },
  {
    handle: 'sustainability',
    title: 'Sustainability',
    body: [
      '<p>We would rather show the numbers than use the word.</p>',
      '<h2>What we measure</h2>',
      '<p>Every pair carries a carbon footprint in kilograms of CO2e, printed on the box and shown on the product page. It covers materials, manufacture, and shipping to our warehouse. It is not a marketing figure — the boots score worse than the sandals, and we print that too.</p>',
      '<h2>Shipping</h2>',
      '<p>Carbon neutral on every order. We pay for the reduction at the point of shipping rather than buying offsets after the fact, which is a meaningfully different thing.</p>',
      '<h2>The end of a pair</h2>',
      '<p>Send any worn-out Fernway pair back and we will either resole it or break it down for material recovery. Merino goes back into insulation, foam goes back into soles. Postage is on us.</p>',
    ].join(''),
  },
  {
    handle: 'size-guide',
    title: 'Size guide',
    body: [
      '<p>Our shoes run true to size. If you are between sizes, take the larger one — the merino gives about a half size over the first month of wear and the knit gives slightly less.</p>',
      '<h2>Measuring</h2>',
      '<p>Stand on a sheet of paper with your heel against a wall, mark the longest toe, and measure the distance in centimetres. Do it at the end of the day, when your feet are at their largest.</p>',
      '<table><thead><tr><th>US</th><th>EU</th><th>UK</th><th>Length (cm)</th></tr></thead><tbody><tr><td>5</td><td>36</td><td>3</td><td>22.5</td></tr><tr><td>6</td><td>37</td><td>4</td><td>23.4</td></tr><tr><td>7</td><td>38</td><td>5</td><td>24.2</td></tr><tr><td>8</td><td>39</td><td>6</td><td>25.1</td></tr><tr><td>9</td><td>41</td><td>7</td><td>26.0</td></tr><tr><td>10</td><td>42</td><td>8</td><td>26.8</td></tr><tr><td>11</td><td>44</td><td>9</td><td>27.7</td></tr><tr><td>12</td><td>45</td><td>10</td><td>28.5</td></tr><tr><td>13</td><td>46</td><td>11</td><td>29.4</td></tr></tbody></table>',
      '<p>Wrong size? Send it back inside 30 days and we will swap it. Postage is on us both ways.</p>',
    ].join(''),
  },
  {
    handle: 'shipping-and-returns',
    title: 'Shipping and returns',
    body: [
      '<h2>Shipping</h2>',
      '<p>Free on orders over $75. Standard delivery is two to five working days; express is next working day if you order before 2pm. Every order ships carbon neutral.</p>',
      '<h2>The 30-day trial</h2>',
      '<p>Wear them. Outside, on a real walk, on a real day. If they are not right, send them back inside 30 days for a full refund or an exchange — worn, washed, muddy, it does not matter.</p>',
      '<h2>Returns</h2>',
      '<p>Start a return from your account, or reply to your order confirmation. We email a prepaid label. Refunds land three to five working days after the pair reaches us.</p>',
      '<h2>Worn-out pairs</h2>',
      '<p>Past 30 days and past saving, send them back anyway. We resole what we can and recover the materials from what we cannot.</p>',
    ].join(''),
  },
  {
    handle: 'contact',
    title: 'Contact',
    templateSuffix: 'contact',
    body: [
      '<p>We read every message and reply within one working day.</p>',
      '<p>Prefer email? <a href="mailto:hello@fernway.example">hello@fernway.example</a>. For anything about an order, quote the order number and we will get there faster.</p>',
    ].join(''),
  },
  {
    handle: 'faq',
    title: 'FAQ',
    body: [
      '<h2>I am between sizes. Which do I take?</h2>',
      '<p>The larger one. Merino gives about a half size over the first month; knit gives slightly less.</p>',
      '<h2>Can I really machine wash them?</h2>',
      '<p>Yes. Cold, gentle cycle, insoles and laces out, air dry away from direct heat. Not the tumble dryer — heat is what wrecks wool, not water.</p>',
      '<h2>How does the 30-day trial work?</h2>',
      '<p>Wear them properly for up to 30 days. If they are not right, start a return from your account and we send a prepaid label. Worn and washed is fine.</p>',
      '<h2>How long does delivery take?</h2>',
      '<p>Two to five working days on standard, next working day on express if you order before 2pm. Free over $75.</p>',
      '<h2>What do I do with an old pair?</h2>',
      '<p>Send them back. We resole what we can and recover the materials from what we cannot. Postage is on us.</p>',
    ].join(''),
  },
];

/* --------------------------------------------------------------------------
   Blog (§11 journal posts)
   -------------------------------------------------------------------------- */

export const BLOG = {
  handle: 'journal',
  title: 'Journal',
};

/**
 * `daysAgo` staggers the posts across the past six weeks (§12.5). The actual
 * date is computed at seed time — storing absolute dates here would make the
 * demo store look abandoned within a month of writing this file.
 *
 * Every excerpt is written, not truncated. card-article renders
 * `article.excerpt` and nothing else, so a post without one shows no summary
 * at all.
 */
export const ARTICLES = [
  {
    handle: 'how-we-measure-a-shoes-carbon-footprint',
    title: "How we measure a shoe's carbon footprint",
    author: 'Fernway',
    daysAgo: 4,
    image: 'demo-article-1.webp',
    excerpt:
      'The number on the box covers materials, manufacture and freight. Here is what goes into it, and the two things it deliberately leaves out.',
    body: [
      '<p>There is a number printed on every box we ship. It is in kilograms of CO2e, it is usually somewhere between two and ten, and it is the single most argued-about thing in the workshop.</p>',
      '<h2>What is in it</h2>',
      '<p>Three things. The materials, measured from farm or forest to the point they arrive as usable fibre. The manufacture, measured at the factory. And the freight from the factory to our warehouse, by whichever route that pair actually took.</p>',
      '<h2>What is not</h2>',
      '<p>Two omissions, both deliberate. We do not count the delivery to your door, because we buy that reduction separately and counting it here would be counting it twice. And we do not count what happens after you are done with the pair, because we cannot know whether you send it back to us.</p>',
      '<h2>Why the boots look bad</h2>',
      '<p>The Bracken Boot scores 9.7. The Tideline Sandal scores 2.4. That is not a failure of the boot — it is four times the material and a rubber tread. We print both because a number that only ever flatters is not a measurement.</p>',
    ].join(''),
  },
  {
    handle: 'washing-merino-without-wrecking-it',
    title: 'Washing merino without wrecking it',
    author: 'Fernway',
    daysAgo: 18,
    image: 'demo-article-2.webp',
    excerpt:
      'Wool does not mind water. It minds heat and it minds agitation. Get those two right and a merino upper outlasts the sole under it.',
    body: [
      '<p>The most common thing we hear is that someone is scared to wash them. Fair — most of us have shrunk a jumper. But the jumper did not shrink because it got wet.</p>',
      '<h2>Cold, gentle, insoles out</h2>',
      '<p>Cold water, the gentle cycle, laces and insoles removed. The insoles dry at a different rate to the upper and trapping damp between them is what makes a shoe smell.</p>',
      '<h2>Never the dryer</h2>',
      '<p>Heat is what felts wool: the scales on each fibre open, interlock, and do not come apart again. A tumble dryer does in forty minutes what ten years of wear would not.</p>',
      '<h2>Reshape while damp</h2>',
      '<p>Stuff them with a towel and leave them somewhere with moving air. Not a radiator. They will be dry by morning and the right shape when they are.</p>',
    ].join(''),
  },
  {
    handle: 'field-notes-200-miles-in-the-coastline-runner',
    title: 'Field notes: 200 miles in the Coastline Runner',
    author: 'Fernway',
    daysAgo: 34,
    image: 'demo-article-3.webp',
    excerpt:
      'Two hundred miles on road and gravel, four washes, one very wet fortnight. What held up, what did not, and the one change it prompted.',
    body: [
      '<p>We put a pair on one of our own for a season and asked for the unflattering version. Two hundred miles, mostly road, some gravel, through a fortnight of rain that did not let up.</p>',
      '<h2>The upper</h2>',
      '<p>Held its shape. Four machine washes and the merino has not pilled anywhere that shows. It picked up a permanent mark on the left toe from a kerb, which is a kerb problem rather than a shoe problem.</p>',
      '<h2>The sole</h2>',
      '<p>Still springy. We measured rebound at the start and at 200 miles and lost about four percent, which is inside what we expected and well inside what you would notice.</p>',
      '<h2>What did not hold up</h2>',
      '<p>The heel collar rubbed on longer runs, on one foot only. That is a fit problem, and it is the reason the next run has a slightly softer collar. The pair in the photographs is the old one.</p>',
    ].join(''),
  },
];

/* --------------------------------------------------------------------------
   Menus (§12.5)
   -------------------------------------------------------------------------- */

/**
 * The mega menu renders `link.links` two levels deep. Shop therefore needs
 * children *with children* — a flat Shop collapses the mega to one column and
 * the feature card never appears. §12.5 calls this out specifically; verify
 * the nesting depth in admin after seeding rather than assuming it took.
 */
export const MENUS = [
  {
    handle: 'main-menu',
    title: 'Main menu',
    items: [
      {
        title: 'Shop',
        url: '/collections/best-sellers',
        children: [
          {
            title: "Men's",
            url: '/collections/mens',
            children: [
              { title: 'Sneakers', url: '/collections/mens' },
              { title: 'Boots', url: '/collections/mens' },
              { title: 'All men’s', url: '/collections/mens' },
            ],
          },
          {
            title: "Women's",
            url: '/collections/womens',
            children: [
              { title: 'Sneakers', url: '/collections/womens' },
              { title: 'Sandals', url: '/collections/womens' },
              { title: 'All women’s', url: '/collections/womens' },
            ],
          },
          {
            title: 'Active',
            url: '/collections/active',
            children: [
              { title: 'Runners', url: '/collections/active' },
              { title: 'Trail', url: '/collections/active' },
            ],
          },
          {
            title: 'Lounge',
            url: '/collections/lounge',
            children: [
              { title: 'Loungers', url: '/collections/lounge' },
              { title: 'Slip-ons', url: '/collections/lounge' },
            ],
          },
        ],
      },
      { title: 'Materials', url: '/pages/materials' },
      { title: 'Journal', url: '/blogs/journal' },
      { title: 'About', url: '/pages/about' },
    ],
  },
  {
    handle: 'footer-shop',
    title: 'Shop',
    items: [
      { title: "Men's", url: '/collections/mens' },
      { title: "Women's", url: '/collections/womens' },
      { title: 'Active', url: '/collections/active' },
      { title: 'Lounge', url: '/collections/lounge' },
      { title: 'New arrivals', url: '/collections/new-arrivals' },
    ],
  },
  {
    handle: 'footer-help',
    title: 'Help',
    items: [
      { title: 'Size guide', url: '/pages/size-guide' },
      { title: 'Shipping and returns', url: '/pages/shipping-and-returns' },
      { title: 'FAQ', url: '/pages/faq' },
      { title: 'Contact', url: '/pages/contact' },
    ],
  },
  {
    handle: 'footer-company',
    title: 'Company',
    items: [
      { title: 'About', url: '/pages/about' },
      { title: 'Materials', url: '/pages/materials' },
      { title: 'Sustainability', url: '/pages/sustainability' },
      { title: 'Journal', url: '/blogs/journal' },
    ],
  },
];

/* --------------------------------------------------------------------------
   Derived helpers
   -------------------------------------------------------------------------- */

/**
 * The image filenames a product expects, in position order.
 * @param {number} index 0-based position in PRODUCTS
 * @returns {string[]}
 */
export function productImages(index) {
  const n = index + 1;
  return [`demo-product-${n}.webp`, `demo-product-${n}-alt.webp`];
}

/**
 * Every filename the seed expects to find in the media map, so a run can
 * report all of them missing at once rather than one per failed lookup.
 * @returns {string[]}
 */
export function expectedMediaFilenames() {
  const names = [];

  PRODUCTS.forEach((_, index) => names.push(...productImages(index)));
  COLLECTIONS.forEach((collection) => {
    if (collection.image) names.push(collection.image);
  });
  ARTICLES.forEach((article) => {
    if (article.image) names.push(article.image);
  });

  return names;
}
