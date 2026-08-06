import { defineSubclass, feature } from "../../../../builders"

export const swarmkeeper = defineSubclass({
  id: "swarmkeeper",
  name: "Swarmkeeper",
  className: "ranger",
  source: "Tasha",
  features: [
    feature(3, "Gathered Swarm", "Tasha"),
    feature(3, "Swarmkeeper Magic", "Tasha"),
    feature(7, "Writhing Tide", "Tasha"),
    feature(11, "Mighty Swarm", "Tasha"),
    feature(15, "Swarming Dispersal", "Tasha"),
  ],
})
