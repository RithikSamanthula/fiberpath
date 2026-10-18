const ALL: Record<string, { color: string; title: string; text: string }> = {
  unserved: { color: "red", title: "Unserved", text: "No internet of at least 25 Mbps down and 3 Mbps up is available at the address. That is the federal line for “real” broadband." },
  underserved: { color: "amber", title: "Underserved", text: "Some service exists, but it is slower than 100 Mbps down and 20 Mbps up." },
  aerial: { color: "blue", title: "Fiber on poles", text: "Fiber cable hung on existing utility poles. It is the cheapest way to build, so the plan prefers roads that have poles." },
  buried: { color: "amber", title: "Buried fiber", text: "Fiber dug into the ground. It costs about twice as much per foot, and is used where there are no poles." },
  wireless: { color: "green", title: "Fixed wireless", text: "A tower beams internet to a small antenna on the house. It only works if nothing, like a ridge or trees, blocks the path." },
  sight: { color: "", title: "Line of sight", text: "A wireless signal needs a clear path from tower to home, with extra room around it. FiberPath checks terrain and tree height along the whole path." },
};

export default function Glossary({ items }: { items: (keyof typeof ALL)[] }) {
  return (
    <div className="terms">
      {items.map((k) => (
        <div key={k} className={`term ${ALL[k].color}`}>
          <b>{ALL[k].title}</b>
          <span className="small">{ALL[k].text}</span>
        </div>
      ))}
    </div>
  );
}
