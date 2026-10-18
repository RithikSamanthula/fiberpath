const ALL: Record<string, { color: string; title: string; text: string }> = {
  unserved: { color: "red", title: "Unserved", text: "No internet at 25 Mbps down and 3 Mbps up or faster is available at the address. That is the federal definition." },
  underserved: { color: "amber", title: "Underserved", text: "Some service is available, but it is slower than 100 Mbps down and 20 Mbps up." },
  aerial: { color: "blue", title: "Fiber on poles", text: "Cable hung on utility poles that already exist. It costs the least, so the plan favors roads that have poles." },
  buried: { color: "amber", title: "Buried fiber", text: "Cable put in the ground. It costs about twice as much per foot, so it is used where there are no poles." },
  wireless: { color: "green", title: "Fixed wireless", text: "A tower sends internet to a small antenna on the house. A hill or trees in the way can block it." },
  sight: { color: "", title: "Line of sight", text: "A wireless signal needs a clear path from the tower to the home, with some room around it. The plan checks the ground and tree height along that path." },
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
