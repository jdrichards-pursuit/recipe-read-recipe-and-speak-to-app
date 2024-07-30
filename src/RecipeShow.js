import { useParams } from "react-router-dom";
import { useState, useEffect, useRef } from "react";
import placeholderImage from "../../assets/recipe_place_holder.png";
import { capitalizeFirstLetter } from "../../helpers/helpers";

const URL = import.meta.env.VITE_BASE_URL;

const RecipeShow = () => {
  const { id } = useParams();
  const [rate, setRate] = useState(1);
  const [singleRecipe, setSingleRecipe] = useState(null);
  const [recipeCategories, setRecipeCategories] = useState([]);
  const [currentCommand, setCurrentCommand] = useState(null); // New state for current command
  const [voices, setVoices] = useState([]); // State to store available voices
  const [selectedVoice, setSelectedVoice] = useState(null); // State to store selected voice
  const recognitionRef = useRef(null);
  const synthesisRef = useRef(window.speechSynthesis);
  const isRecognitionRunning = useRef(false); // Flag to track recognition state
  const utteranceIndexRef = useRef(0); // Track the current utterance index

  useEffect(() => {
    fetch(`${URL}/api/recipes/single_recipe/${id}`)
      .then((res) => res.json())
      .then((data) => {
        setSingleRecipe(data);
      })
      .catch((error) => console.error("Error fetching recipe:", error));

    fetch(`${URL}/api/categories/recipes/${id}`)
      .then((res) => res.json())
      .then((data) => {
        setRecipeCategories(data.map((elem) => elem.category_name));
      })
      .catch((error) => console.error("Error fetching recipe:", error));
  }, [id]);

  useEffect(() => {
    if (!("webkitSpeechRecognition" in window)) {
      console.error("Speech Recognition API not supported in this browser.");
      return;
    }

    // Request microphone access
    navigator.mediaDevices
      .getUserMedia({ audio: true })
      .then((stream) => {
        console.log("Microphone access granted");
        const SpeechRecognition =
          window.SpeechRecognition || window.webkitSpeechRecognition;
        // This is to create a new instance of the speech recognition API
        const recognition = new SpeechRecognition();
        // This is to set the recognition to the current recognition in the ref of the component
        recognitionRef.current = recognition;
        // Default settings for the speech recognition API
        recognition.continuous = true;
        recognition.interimResults = false;
        recognition.lang = "en-US";
        // This is to set the event handler for when the speech recognition results are returned.
        recognition.onresult = (event) => {
          const command = event.results[event.results.length - 1][0].transcript
            .trim()
            .toLowerCase();
          console.log("Voice command received:", command);
          setCurrentCommand(command); // Update the current command state
        };
        // This is to set the event handler for when the speech recognition encounters an error.
        recognition.onerror = (event) => {
          console.error("Speech recognition error:", event.error);
          if (event.error === "no-speech" || event.error === "audio-capture") {
            recognitionRef.current.stop();
            recognitionRef.current.onend = () => {
              if (recognitionRef.current) {
                recognitionRef.current.start();
              }
            };
          }
        };

        // Start recognition immediately
        recognition.start();
        // This is to set the recognition to running for the ref of the component
        isRecognitionRunning.current = true;
        console.log("Speech recognition started");
      })
      .catch((error) => {
        console.error("Microphone access denied:", error);
      });

    return () => {
      // This is to stop the recognition when the component unmounts
      if (recognitionRef.current) {
        recognitionRef.current.stop();
        isRecognitionRunning.current = false;
        console.log("Speech recognition stopped");
      }
    };
  }, []); // Run only once when the component mounts

  useEffect(() => {
    // This is to load the voices when the component mounts but it is not being used.
    const loadVoices = () => {
      const voices = synthesisRef.current.getVoices();
      setVoices(voices);
      console.log("Available voices:", voices); // Log available voices
    };

    // Load voices
    loadVoices();

    // Reload voices when they change (some browsers may require this)
    synthesisRef.current.onvoiceschanged = loadVoices;
  }, []);

  useEffect(() => {
    // This is to handle the current command when it is returned from the speech recognition API
    if (currentCommand) {
      console.log("Handling command:", currentCommand);
      if (currentCommand.includes("play")) {
        console.log("Executing handleRead");
        handleRead();
      } else if (currentCommand.includes("continue")) {
        console.log("Executing handleContinue");
        handleContinue();
      } else if (currentCommand.includes("repeat")) {
        console.log("Executing handleRepeat");
        handleRepeat();
      } else if (currentCommand.includes("start over")) {
        console.log("Executing handleStartOver");
        handleStartOver();
      } else if (currentCommand.includes("stop")) {
        console.log("Executing handleStop");
        handleStop();
      }

      // Clear the current command after handling it
      setCurrentCommand(null);
    }
  }, [currentCommand]); // Add currentCommand as a dependency

  if (!singleRecipe) {
    return <div>Loading...</div>;
  }

  const { name, ingredients, chef, family, created_at, photo, steps } =
    singleRecipe;
  const ingredientList = ingredients.split(",").map((item) => item.trim());
  const stepsList = steps.split(",").map((item) => item.trim());

  // This is to create the utterances for the speech synthesis API
  const utterances = [
    new SpeechSynthesisUtterance(
      `This is the ${name} recipe from ${chef}.......`
    ),
    new SpeechSynthesisUtterance(
      `Here are the Ingredients........ ${ingredients}`
    ),
    new SpeechSynthesisUtterance(`And now the steps for preparation. ${steps}`),
  ];

  // This is to set the rate and voice for the utterances
  utterances.forEach((utterance) => {
    utterance.rate = rate;
    if (selectedVoice) {
      utterance.voice = selectedVoice; // Set the selected voice
    }
  });

  function handleRead() {
    utteranceIndexRef.current = 0;
    speakNextUtterance();
  }
  // This is to speak the next utterance based on the current index
  function speakNextUtterance() {
    if (utteranceIndexRef.current < utterances.length) {
      const utterance = utterances[utteranceIndexRef.current];
      utterance.onend = () => {
        // After each utterance, ask for a command
        const commandUtterance = new SpeechSynthesisUtterance(
          "Say 'continue' to proceed, 'repeat' to hear this again, 'start over' to begin from the start, or 'stop' to cancel."
        );
        commandUtterance.rate = rate;
        if (selectedVoice) {
          commandUtterance.voice = selectedVoice; // Set the selected voice for the command prompt
        }
        commandUtterance.onend = () => {
          if (!isRecognitionRunning.current && recognitionRef.current) {
            recognitionRef.current.start();
            isRecognitionRunning.current = true;
          }
        };
        synthesisRef.current.speak(commandUtterance);
      };
      synthesisRef.current.speak(utterance);
    }
  }

  function handleContinue() {
    // This is to stop the recognition when the command is received
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      isRecognitionRunning.current = false;
    }
    utteranceIndexRef.current++;
    speakNextUtterance();
  }

  function handleRepeat() {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      isRecognitionRunning.current = false;
    }
    speakNextUtterance();
  }

  function handleStartOver() {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      isRecognitionRunning.current = false;
    }
    utteranceIndexRef.current = 0;
    speakNextUtterance();
  }

  function handleStop() {
    console.log("Stopping speech synthesis");
    synthesisRef.current.cancel();
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      isRecognitionRunning.current = false;
      recognitionRef.current.onend = () => {
        console.log("Speech recognition stopped for stop command");
      };
    }
  }

  function increaseRate() {
    setRate((prevRate) => Math.min(prevRate + 0.1, 10));
  }

  function decreaseRate() {
    setRate((prevRate) => Math.max(prevRate - 0.1, 0.1));
  }

  function selectVoice(language, gender) {
    const filteredVoices = voices.filter(
      (voice) =>
        voice.lang === language && voice.name.toLowerCase().includes(gender)
    );
    setSelectedVoice(filteredVoices[0] || voices[0]);
  }

  return (
    <div className="p-4 bg-[#C7DEF1] rounded-lg shadow-lg">
      <div className="bg-white rounded-md p-4 mb-3">
        <h1 className="text-2xl font-bold mb-4 text-center">{name}</h1>
        <img
          src={photo || placeholderImage}
          alt={name}
          className="mb-4 shadow-xl"
        />
        <p className="text-lg mb-2 font-bold">
          Family:
          <span className="font-thin"> {family}</span>
        </p>
        <p className="text-lg mb-2">Chef: {capitalizeFirstLetter(chef)}</p>
        {family !== "defaultFamily" && (
          <p className="text-lg mb-2 font-bold">
            Family:
            <span className="font-thin"> {family}</span>
          </p>
        )}
        <p className="text-lg mb-2">
          Created at: {new Date(created_at).toLocaleDateString()}
        </p>
      </div>
      <div className="bg-white shadow-lg rounded-md p-4">
        <h2 className="text-xl font-semibold mb-2">Ingredients</h2>
        <ul className="list-disc ml-5 mb-4">
          {ingredientList.map((ingredient, index) => (
            <li key={index}>{ingredient}</li>
          ))}
        </ul>
      </div>
      <div className="bg-white shadow-lg rounded-md p-4 mt-3">
        <h2 className="text-xl font-semibold mb-2">Steps</h2>
        <ol className="list-decimal ml-5">
          {stepsList.map((step, index) => (
            <li key={index}>{step}</li>
          ))}
        </ol>

        <div>
          <h1 className="text-xl font-semibold mb-2">Categories</h1>
          {recipeCategories.length > 0 &&
            recipeCategories.map((category, index) => {
              return <li key={index}>{category}</li>;
            })}
        </div>
      </div>
      <div>
        <button
          style={{
            height: "60px",
            width: "160px",
            padding: "5px",
            font: ".5rem",
          }}
          onClick={() => selectVoice("en-GB", "male")}
        >
          English Male
        </button>
        <button
          style={{ height: "60px", width: "160px", padding: "5px" }}
          onClick={() => selectVoice("en-GB", "female")}
        >
          English Female
        </button>
        <button
          style={{ height: "60px", width: "160px", padding: "5px" }}
          onClick={() => selectVoice("en-US", "male")}
        >
          American Male
        </button>
        <button
          style={{ height: "60px", width: "160px", padding: "5px" }}
          onClick={() => selectVoice("en-US", "female")}
        >
          American Female
        </button>
        <button
          style={{ height: "60px", width: "160px", padding: "5px" }}
          onClick={() => selectVoice("en-AU", "male")}
        >
          Australian Male
        </button>
        <button
          style={{ height: "60px", width: "160px", padding: "5px" }}
          onClick={() => selectVoice("en-AU", "female")}
        >
          Australian Female
        </button>
        <br />
        <button
          style={{ width: "160px", height: "40px", marginTop: "10px" }}
          onClick={handleRead}
        >
          Play Recipe
        </button>
        <button
          style={{ width: "160px", height: "40px", marginTop: "10px" }}
          onClick={handleStop}
        >
          Stop
        </button>
        <div style>
          <button onClick={decreaseRate}>-</button>
          <span> Speed: {rate.toFixed(1)} </span>
          <button onClick={increaseRate}>+</button>
        </div>
      </div>
    </div>
  );
};

export default RecipeShow;
