import { defineSubclass, feature } from "../../../../builders"

const BATTLE_MASTER_MANEUVERS = ["Commander's Strike", "Disarming Attack", "Distracting Strike", "Evasive Footwork", "Feinting Attack", "Goading Attack", "Lunging Attack", "Maneuvering Attack", "Menacing Attack", "Parry", "Precision Attack", "Pushing Attack", "Rally", "Riposte", "Sweeping Attack", "Trip Attack", "Ambush", "Bait and Switch", "Brace", "Commanding Presence", "Grappling Strike", "Quick Toss", "Tactical Assessment"]

export const battleMaster = defineSubclass({
  id: "battle-master",
  name: "Battle Master",
  className: "fighter",
  source: "PHB",
  features: [
    feature(3, "Combat Superiority", "PHB", { choice: { id: "battle-master-maneuvers-3", label: "Maneuvers", kind: "maneuver", count: 3, options: ["Commander's Strike", "Disarming Attack", "Distracting Strike", "Evasive Footwork", "Feinting Attack", "Goading Attack", "Lunging Attack", "Maneuvering Attack", "Menacing Attack", "Parry", "Precision Attack", "Pushing Attack", "Rally", "Riposte", "Sweeping Attack", "Trip Attack", "Ambush", "Bait and Switch", "Brace", "Commanding Presence", "Grappling Strike", "Quick Toss", "Tactical Assessment"] } }),
    feature(3, "Student of War"),
    feature(7, "Know Your Enemy", "PHB", { choice: { id: "battle-master-maneuvers-7", label: "Additional maneuvers", kind: "maneuver", count: 2, options: ["Commander's Strike", "Disarming Attack", "Distracting Strike", "Evasive Footwork", "Feinting Attack", "Goading Attack", "Lunging Attack", "Maneuvering Attack", "Menacing Attack", "Parry", "Precision Attack", "Pushing Attack", "Rally", "Riposte", "Sweeping Attack", "Trip Attack", "Ambush", "Bait and Switch", "Brace", "Commanding Presence", "Grappling Strike", "Quick Toss", "Tactical Assessment"] } }),
    feature(10, "Improved Combat Superiority", "PHB", { choice: { id: "battle-master-maneuvers-10", label: "Additional maneuvers", kind: "maneuver", count: 2, options: ["Commander's Strike", "Disarming Attack", "Distracting Strike", "Evasive Footwork", "Feinting Attack", "Goading Attack", "Lunging Attack", "Maneuvering Attack", "Menacing Attack", "Parry", "Precision Attack", "Pushing Attack", "Rally", "Riposte", "Sweeping Attack", "Trip Attack", "Ambush", "Bait and Switch", "Brace", "Commanding Presence", "Grappling Strike", "Quick Toss", "Tactical Assessment"] } }),
    feature(15, "Relentless", "PHB", { choice: { id: "battle-master-maneuvers-15", label: "Additional maneuvers", kind: "maneuver", count: 2, options: ["Commander's Strike", "Disarming Attack", "Distracting Strike", "Evasive Footwork", "Feinting Attack", "Goading Attack", "Lunging Attack", "Maneuvering Attack", "Menacing Attack", "Parry", "Precision Attack", "Pushing Attack", "Rally", "Riposte", "Sweeping Attack", "Trip Attack", "Ambush", "Bait and Switch", "Brace", "Commanding Presence", "Grappling Strike", "Quick Toss", "Tactical Assessment"] } }),
    feature(18, "Improved Combat Superiority"),
  ],
})
