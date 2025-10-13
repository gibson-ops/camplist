import { BrowserRouter, Routes, Route } from "react-router";
import Home from "./pages/Home";
import ListDetail from "./pages/ListDetail";
import Groups from "./pages/Groups";
import GroupDetail from "./pages/GroupDetail";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/list/:id" element={<ListDetail />} />
        <Route path="/groups" element={<Groups />} />
        <Route path="/group/:id" element={<GroupDetail />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
