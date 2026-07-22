import { createTheme } from "@mui/material/styles";

// Matches the palette already used throughout AppShell.jsx's inline
// styles — the goal is for MUI components to sit invisibly among the
// hand-styled ones, not introduce a visually distinct "MUI look." Kept
// deliberately small (no CssBaseline, no global reset) so introducing MUI
// doesn't have side effects on the rest of the app, which isn't using MUI
// yet — this is a foundation for future MUI components, not a full
// migration.
//
// `theme.bco` holds golf-specific tones and fonts that don't map cleanly
// onto MUI's default palette slots (e.g. muted label text, input borders,
// chip/success backgrounds). Components should prefer these tokens over
// hardcoded hex literals as they're touched — see REFACTOR.md P0.
const fonts = {
  body: "'Inter', system-ui, sans-serif",
  display: "'Fraunces', serif",
  mono: "'IBM Plex Mono', monospace",
};

const theme = createTheme({
  palette: {
    primary: {
      main: "#1B4332",
      contrastText: "#F3EFE2",
    },
    background: {
      default: "#FBF8F1",
      paper: "#FFFFFF",
    },
    text: {
      primary: "#2C2A22",
      secondary: "#6B6455",
      disabled: "#B4AE9E",
    },
    divider: "#E4DFCE",
    error: {
      main: "#A3492E",
      dark: "#8C2F2A",
      light: "#F7DCDA",
    },
    info: {
      main: "#26456B",
      light: "#DCE7F2",
    },
    success: {
      main: "#1B4332",
      light: "#DCEFE3",
    },
  },
  typography: {
    fontFamily: fonts.body,
  },
  shape: {
    borderRadius: 10,
  },
  bco: {
    fonts,
    colors: {
      mutedLabel: "#8A8371", // muted label text (111 uses)
      inputBorder: "#DCD6C4", // input border (36 uses)
      successBg: "#DCEFE3", // chip/success bg (16 uses)
      warnText: "#3F3B32",
      subtleBorder: "#A39C89",
      chipBorderMuted: "#B9B3A2",
      surfaceMuted: "#EFEBDE",
      surfaceHover: "#EDEAE0",
      surfaceAlt: "#F0ECDF",
      surfaceAlt2: "#F9F7F0",
      cardBorder: "#D8D2C2",
      chipNeutralBorder: "#C9C2AC",
      successAccent: "#6FAE8C",
      warnBg: "#FBEAD9",
      warnAccent: "#8A4B1E",
      errorBorder: "#D98884",
      errorText: "#C9564F",
    },
  },
});

export default theme;
