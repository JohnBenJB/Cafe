import { useState } from "react";
import Chat from "./Chat";

function App() {
  // const [greeting, setGreeting] = useState('');
  // function handleSubmit(event) {
  //   event.preventDefault();
  //   const name = event.target.elements.name.value;
  //   Cafe_backend.greet(name).then((greeting) => {
  //     setGreeting(greeting);
  //   });
  //   return false;
  // }

  return (
    <main>
      <Chat />
    </main>
  );
}

export default App;
