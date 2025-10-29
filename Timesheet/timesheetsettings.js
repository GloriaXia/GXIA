function App() {
  const { getData, saveData } = useDataStorage();
  const data = getData() || {};
  const s = data.settings || {};
  const set = (k, v) => saveData({ ...data, settings: { ...s, [k]: v } });

  return (
    <Settings>
      <SettingTitle>Timesheet Settings</SettingTitle>

      <SettingInput
        label="Tag"
        type="text"
        value={s.tag ?? "timesheet"}
        onChange={(e)=>set("tag", e.target.value)}
      />

      <FolderSettingAutocomplete
        label="Folder"
        value={s.folder ?? "10 Projects/Timesheets"}
        onChange={(v)=>set("folder", v)}
      />

      <SettingSwitch
        label="Limit to folder"
        value={Boolean(s.limitToFolder ?? false)}
        onChange={(v)=>set("limitToFolder", v)}
      />

      <SettingDivider />

      <PropertySettingAutocomplete
        label="Date property"
        value={s.dateProp ?? "date"}
        onChange={(v)=>set("dateProp", v)}
      />
      <PropertySettingAutocomplete
        label="Start property"
        value={s.startProp ?? "Start Time"}
        onChange={(v)=>set("startProp", v)}
      />
      <PropertySettingAutocomplete
        label="Finish property"
        value={s.finishProp ?? "Finish Time"}
        onChange={(v)=>set("finishProp", v)}
      />
      <PropertySettingAutocomplete
        label="Duration property"
        value={s.durationProp ?? "duration"}
        onChange={(v)=>set("durationProp", v)}
      />

      <SettingDivider />

      <SettingInput
        label="Default start (HH:MM)"
        type="text"
        value={s.defaultStart ?? "07:00"}
        onChange={(e)=>set("defaultStart", e.target.value)}
      />
      <SettingInput
        label="Default finish (HH:MM)"
        type="text"
        value={s.defaultFinish ?? "17:00"}
        onChange={(e)=>set("defaultFinish", e.target.value)}
      />
      <SettingInput
        label="Hit threshold (h)"
        type="number" step="0.5"
        value={s.minHoursForHit ?? 1}
        onChange={(e)=>set("minHoursForHit", Number(e.target.value))}
      />
      <SettingInput
        label="Target hours (outline)"
        type="number" step="0.5"
        value={s.targetHours ?? 10}
        onChange={(e)=>set("targetHours", Number(e.target.value))}
      />

      <SettingDivider />

      <SettingInput
        label="Filename pattern"
        type="text"
        value={s.filenamePattern ?? "Timesheet - ${date}.md"}
        onChange={(e)=>set("filenamePattern", e.target.value)}
      />
      <FileSettingAutocomplete
        label="Template file path"
        value={s.templateFilePath ?? "50 System/Templates/timelog-template"}
        onChange={(v)=>set("templateFilePath", v)}
      />

      <SettingDivider />

      <SettingSwitch
        label="Show day numbers in cells"
        value={Boolean(s.showDayNumbers ?? true)}
        onChange={(v)=>set("showDayNumbers", v)}
      />

      <SettingDescription>
        Configure to match your vault. Use autocomplete for paths/properties.
      </SettingDescription>
    </Settings>
  );
}