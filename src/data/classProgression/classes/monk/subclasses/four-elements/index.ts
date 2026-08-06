import { defineSubclass, feature } from "../../../../builders"

export const fourElements = defineSubclass({
  id: "four-elements",
  name: "Way of the Four Elements",
  className: "monk",
  source: "PHB",
  features: [
    feature(3, "Disciple of the Elements", "PHB", { choice: { id: "elements-disciplines-3", label: "Elemental disciplines", kind: "elemental-discipline", count: 2, options: ["Elemental Attunement", "Fangs of the Fire Snake", "Fist of Four Thunders", "Fist of Unbroken Air", "Rush of the Gale Spirits", "Shape the Flowing River", "Sweeping Cinder Strike", "Water Whip", "Clench of the North Wind", "Gong of the Summit", "Flames of the Phoenix", "Mist Stance", "Ride the Wind", "Breath of Winter", "Eternal Mountain Defense", "River of Hungry Flame", "Wave of Rolling Earth"] } }),
    feature(6, "Additional Elemental Discipline", "PHB", { choice: { id: "elements-disciplines-6", label: "Elemental discipline", kind: "elemental-discipline", count: 1, options: ["Elemental Attunement", "Fangs of the Fire Snake", "Fist of Four Thunders", "Fist of Unbroken Air", "Rush of the Gale Spirits", "Shape the Flowing River", "Sweeping Cinder Strike", "Water Whip", "Clench of the North Wind", "Gong of the Summit", "Flames of the Phoenix", "Mist Stance", "Ride the Wind", "Breath of Winter", "Eternal Mountain Defense", "River of Hungry Flame", "Wave of Rolling Earth"] } }),
    feature(11, "Additional Elemental Discipline", "PHB", { choice: { id: "elements-disciplines-11", label: "Elemental discipline", kind: "elemental-discipline", count: 1, options: ["Elemental Attunement", "Fangs of the Fire Snake", "Fist of Four Thunders", "Fist of Unbroken Air", "Rush of the Gale Spirits", "Shape the Flowing River", "Sweeping Cinder Strike", "Water Whip", "Clench of the North Wind", "Gong of the Summit", "Flames of the Phoenix", "Mist Stance", "Ride the Wind", "Breath of Winter", "Eternal Mountain Defense", "River of Hungry Flame", "Wave of Rolling Earth"] } }),
    feature(17, "Additional Elemental Discipline", "PHB", { choice: { id: "elements-disciplines-17", label: "Elemental discipline", kind: "elemental-discipline", count: 1, options: ["Elemental Attunement", "Fangs of the Fire Snake", "Fist of Four Thunders", "Fist of Unbroken Air", "Rush of the Gale Spirits", "Shape the Flowing River", "Sweeping Cinder Strike", "Water Whip", "Clench of the North Wind", "Gong of the Summit", "Flames of the Phoenix", "Mist Stance", "Ride the Wind", "Breath of Winter", "Eternal Mountain Defense", "River of Hungry Flame", "Wave of Rolling Earth"] } }),
  ],
})
