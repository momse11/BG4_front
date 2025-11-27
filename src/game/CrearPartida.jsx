import { useState, useContext } from "react";
import { AuthContext } from "../auth/AuthProvider"; // importa el contexto
import { useNavigate, Link } from "react-router-dom";

export default function CrearPartida() {
  const { createPartida } = useContext(AuthContext); // usa createPartida del contexto
  const [privado, setPrivado] = useState(false);
  const [contraseña, setContraseña] = useState("");
  const [error, setError] = useState("");
  const [exito, setExito] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setExito("");
    setLoading(true);

    try {
      const partida = await createPartida({
        privado: privado ? 1 : 0,
        contraseña: privado ? contraseña : null,
      });

      setExito(`Partida #${partida.id} creada con éxito`);
      setTimeout(() => navigate(`/partida/${partida.id}`), 1500); // redirige después de crear
    } catch (err) {
      // err puede ser un objeto lanzado por AuthProvider (error.response.data) o un Error
      const serverMsg = err?.error || err?.message || err?.response?.data?.error || null;
      setError(serverMsg || "❌ Error al crear la partida");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex justify-center items-center min-h-screen bg-gray-50">
      <form
        onSubmit={handleSubmit}
        className="bg-white p-6 rounded-xl shadow-md w-96 space-y-4"
      >
        <h2 className="text-2xl font-semibold text-center text-gray-800">
          Crear Partida
        </h2>

        <div className="flex items-center space-x-2">
          <input
            id="privado"
            type="checkbox"
            checked={privado}
            onChange={(e) => setPrivado(e.target.checked)}
            className="h-4 w-4"
          />
          <label htmlFor="privado" className="text-gray-700">
            Partida privada
          </label>
        </div>

        {privado && (
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Contraseña
            </label>
            <input
              type="password"
              value={contraseña}
              onChange={(e) => setContraseña(e.target.value)}
              maxLength={30}
              className="w-full border rounded-lg p-2 mt-1 focus:ring focus:ring-blue-200"
              placeholder="Máx. 30 caracteres"
            />
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className={`w-full text-white py-2 rounded-lg transition ${
            loading ? "bg-gray-400" : "bg-blue-500 hover:bg-blue-600"
          }`}
        >
          {loading ? "Creando..." : "Crear partida"}
        </button>

        {error && (
          <p className="text-red-500 text-sm text-center font-medium">{error}</p>
        )}
        {exito && (
          <p className="text-green-500 text-sm text-center font-medium">
            {exito}
          </p>
        )}
      </form>
        <Link to="/landing">
          <button className="btn-secondary">Volver a mi página de usuario</button>
        </Link>
      </div>

  );
}
