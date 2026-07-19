import { createTheme } from "@mui/material/styles";

// Matches the palette already used throughout AppShell.jsx's inline
// styles — the goal is for MUI components to sit invisibly among the
// hand-styled ones, not introduce a visually distinct "MUI look." Kept
// deliberately small (no CssBaseline, no global reset) so introducing MUI
// doesn't have side effects on the rest of the app, which isn't using MUI
// yet — this is a foundation for future MUI components, not a full
// migration.
const theme = createTheme({
  palette: {
    primary: {
      main: "#1B4332",
      contrastText: "#F3EFE2",
    },
    background: {
      default: "#FBF8F1",
      paper: "#FBF8F1",
    },
    text: {
      primary: "#2C2A22",
      secondary: "#6B6455",
      disabled: "#B4AE9E",
    },
    divider: "#E4DFCE",
  },
  typography: {
    fontFamily: "'Inter', system-ui, sans-serif",
  },
  shape: {
    borderRadius: 10,
  },
});

export default theme;
