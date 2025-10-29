function App() {
    const { getData, saveData } = useDataStorage();
    const data = getData() || {};
    const settings = data.settings || {};
    return <Settings>
      <SettingInput 
        label="Title"
        value={settings.title || ""}
        placeholder="Enter title"
        type="text"
        onChange={(e) => saveData({ ...data, settings: { ...settings, title: e.target.value } })}
      />
      <SettingDescription>Configure your custom component here.</SettingDescription>
    </Settings>
}
