import { NavLink, Route, Routes } from "react-router-dom";
import LogForm from "./pages/LogForm";
import Stats from "./pages/Stats";
import Summary from "./pages/Summary";

export default function App() {
  return (
    <div className="app">
      <header>
        <h1>Leave it cleaner</h1>
        <nav>
          <NavLink to="/" end>Log</NavLink>
          <NavLink to="/stats">Stats</NavLink>
          <NavLink to="/summary">Summary</NavLink>
        </nav>
      </header>
      <main>
        <Routes>
          <Route path="/" element={<LogForm />} />
          <Route path="/stats" element={<Stats />} />
          <Route path="/summary" element={<Summary />} />
        </Routes>
      </main>
    </div>
  );
}
