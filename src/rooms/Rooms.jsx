import { Sofa, CoffeeTable, Bookshelf, Lamp, Plant, Cabinet, SideTable, Mug, FramedPicture, Rounded, Interactive, ObjectScope } from "../scene/Objects.jsx";
import { shared } from "../scene/materials.js";
import { ROOMS, useExperience } from "../state/experience.js";

const record = (title, text, year = "2024") => ({
  title, text, photo: "/peg-pocket-lineup.png", purchaseYear: year,
  warranty: "Coverage stored in Little Worlds", receipt: "Receipt saved · PDF",
  manual: "Owner manual · PDF", maintenance: ["12 Jun 2026 · Condition checked", "04 Feb 2026 · Cleaned and documented"],
  notes: "Little Worlds keeps this record connected to the object and its room.",
});

function Bed({ position }) {
  return <Interactive position={position} dna={{ id: "bed", memory: record("Guest bed", "Linen changed and mattress rotated last month.", "2022") }}>
    <Rounded size={[3.2,.34,1.9]} position={[0,.38,0]} radius={.14} />
    <Rounded size={[2.92,.28,1.65]} position={[0,.66,.05]} radius={.12} material={shared.blue} />
    <Rounded size={[3.2,1.18,.22]} position={[0,1.05,-.82]} radius={.12} />
    {[-.72,.72].map(x => <Rounded key={x} size={[1.22,.18,.58]} position={[x,.91,-.38]} radius={.1} material={shared.paper} />)}
  </Interactive>;
}

function Desk({ position }) {
  return <Interactive position={position} dna={{ id: "desk", memory: record("Writing desk", "The desk stores project notes and device records.", "2025") }}>
    <Rounded size={[2.45,.2,1.1]} position={[0,.82,0]} radius={.12} />
    {[-.9,.9].map(x => <mesh key={x} position={[x,.4,0]} material={shared.timber} castShadow><cylinderGeometry args={[.1,.15,.8,16]} /></mesh>)}
    <Rounded size={[.9,.06,.62]} position={[-.35,.95,-.05]} radius={.04} material={shared.navy} />
  </Interactive>;
}

function Bath({ position }) {
  return <Interactive position={position} dna={{ id: "bath", memory: record("Enamel bath", "Sealant inspection is due in six months.", "2021") }}>
    <Rounded size={[2.45,.72,1.3]} position={[0,.52,0]} radius={.28} material={shared.paper} />
    <Rounded size={[2.02,.1,.9]} position={[0,.88,0]} radius={.25} material={shared.blue} />
    <mesh position={[.82,1.16,-.25]} material={shared.brass} castShadow><torusGeometry args={[.18,.035,10,20,Math.PI]} /></mesh>
  </Interactive>;
}

function Workbench({ position }) {
  return <Interactive position={position} dna={{ id: "workbench", memory: record("Garage workbench", "Tool inventory and paint records are attached.", "2020") }}>
    <Rounded size={[3,.24,1.05]} position={[0,.9,0]} radius={.11} material={shared.timberDark} />
    {[-1.1,1.1].map(x => <Rounded key={x} size={[.24,1.55,.78]} position={[x,.4,0]} radius={.08} />)}
    {[[-.65,1.12],[0,1.12],[.65,1.12]].map(([x,y],i)=><mesh key={i} position={[x,y,0]} material={[shared.red,shared.mustard,shared.navy][i]} castShadow><cylinderGeometry args={[.15,.18,.34,16]} /></mesh>)}
  </Interactive>;
}

export function LivingRoom() {
  return <>
    <Rounded size={[4.35,.045,2.15]} position={[-.65,.15,-.15]} radius={.1} material={shared.red} receiveShadow />
    <Sofa position={[-.75,.15,-1.85]} /><CoffeeTable position={[-.55,.15,-.05]} />
    <Bookshelf position={[2.85,.13,-2.35]} rotation={[0,-.03,0]} /><SideTable position={[-2.95,.14,-1.25]} />
    <Lamp position={[-2.95,.88,-1.25]} /><Plant position={[2.85,.14,.75]} />
    <Cabinet position={[2.45,.13,-1.7]} /><Mug position={[.2,.99,-.06]} />
  </>;
}

export function Kitchen() { return <><Rounded size={[4.8,.04,2.4]} position={[.3,.15,-.25]} radius={.1} material={shared.mustard} /><Cabinet position={[-2.4,.13,-2.35]} /><Cabinet position={[-.55,.13,-2.35]} /><CoffeeTable position={[.3,.15,-.2]} /><Mug position={[.1,.99,-.1]} /><Plant position={[2.65,.14,-1.5]} /><Bookshelf position={[2.75,.13,-2.25]} /></>; }
export function Bedroom() { return <><Rounded size={[4.4,.04,2.55]} position={[-.4,.15,-.45]} radius={.1} material={shared.blue} /><Bed position={[-.55,.15,-1.05]} /><SideTable position={[-2.75,.14,-1.35]} /><Lamp position={[-2.75,.88,-1.35]} /><Cabinet position={[2.65,.13,-1.9]} /><Plant position={[2.75,.14,.8]} /></>; }
export function Bathroom() { return <><Rounded size={[4.3,.04,2.35]} position={[-.1,.15,-.35]} radius={.1} material={shared.blue} /><Bath position={[-.7,.15,-1]} /><Cabinet position={[2.55,.13,-1.95]} /><Plant position={[2.6,.14,.65]} /><SideTable position={[-2.7,.14,-1.5]} /></>; }
export function Garage() { return <><Rounded size={[5.1,.04,2.6]} position={[0,.15,-.2]} radius={.1} material={shared.navy} /><Workbench position={[-.45,.15,-1.55]} /><Bookshelf position={[2.75,.13,-2.25]} /><Cabinet position={[-2.7,.13,1.8]} /><Lamp position={[-2.7,.88,-1.4]} /></>; }
export function Office() { return <><Rounded size={[4.5,.04,2.3]} position={[-.2,.15,-.2]} radius={.1} material={shared.mustard} /><Desk position={[-.35,.15,-1.25]} /><Bookshelf position={[2.75,.13,-2.2]} /><SideTable position={[-2.75,.14,-1.3]} /><Lamp position={[-2.75,.88,-1.3]} /><Plant position={[2.7,.14,.75]} /></>; }

const roomComponents = { "living-room": LivingRoom, kitchen: Kitchen, bedroom: Bedroom, bathroom: Bathroom, garage: Garage, office: Office };

function RoomShell({ room, children }) {
  const selectedRoom = useExperience((s) => s.selectedRoom);
  const roomMeta = useExperience((s) => s.roomMeta);
  const roomScale = useExperience((s) => s.roomScale);
  const roomShape = useExperience((s) => s.roomShape);
  const dividerOffset = useExperience((s) => s.dividerOffset);
  const hiddenRooms = useExperience((s) => s.hiddenRooms);
  if (hiddenRooms[room.id]) return null;
  const footprint = roomScale[room.id] || 1;
  const dividerAffected = room.level === 0 && (room.id === "living-room" || room.id === "kitchen");
  const leftSide = room.id === "living-room";
  const boundaryShift = dividerAffected ? dividerOffset * .42 : 0;
  const boundaryScale = dividerAffected ? 1 + (leftSide ? dividerOffset : -dividerOffset) * .16 : 1;
  const accent = roomMeta[room.id]?.accent;
  const accentMaterial = accent === "sage" ? shared.green : accent === "navy" ? shared.blue : accent === "clay" ? shared.red : shared.timberLight;
  const shape = roomShape[room.id] || { x: 1, z: 1 };
  const selectedAlternate = ROOMS.find((item) => item.alternateRoom && item.id === selectedRoom);
  const visible = room.alternateRoom
    ? selectedRoom === room.id
    : selectedAlternate?.alternateFor !== room.id;
  return <group visible={visible} position={[room.position[0] + boundaryShift, room.position[1], room.position[2]]} scale={[footprint * boundaryScale * shape.x, 1, footprint * shape.z]} name={`room:${room.id}`} userData={{ roomId: room.id, persistent: true }}>
    <Rounded size={[4.55,.035,2.9]} position={[0,.16,0]} radius={.08} material={accentMaterial} receiveShadow userData={{ placementSurface: "floor", roomId: room.id }} />
    <group scale={.58} position={[0,0,-.08]}><ObjectScope id={room.id}>{children}</ObjectScope></group>
    <pointLight position={[0,2.3,.4]} intensity={.2} distance={5.5} color={room.level ? "#fff0dc" : "#ffdca8"} />
  </group>;
}

export function PersistentRooms({ level }) {
  const customRooms = useExperience((s) => s.customRooms);
  const activeFloor = useExperience((s) => s.activeFloor);
  const rooms = [...ROOMS, ...customRooms];
  return <group name="persistent-room-world">
    {rooms.filter((room) => room.level === level && (activeFloor === null || room.level === activeFloor)).map((room) => {
      const Component = roomComponents[room.id];
      return <RoomShell key={room.id} room={room}>{Component ? <Component /> : null}</RoomShell>;
    })}
  </group>;
}
