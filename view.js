function App() {
  const { getData, saveData } = useDataStorage();
  const app = useObsidianApp();
  const data = getData() || {};
  const settings = data.settings || {};
  const title = settings.title || "Custom Component Sample";
  const count = data.count ?? 0;
  
  return (
    <div className="sample--RootContainer">
      <h1>{title}</h1>
      <p>{count}</p>
      <div className="sample--ButtonContainer">
      <button onClick={() => saveData({ ...data, count: count + 1 })}>
        +1
      </button>
      <button onClick={() => saveData({ ...data, count: count - 1 })}>
        -1
      </button>
      </div>
  </div>
  );
}
