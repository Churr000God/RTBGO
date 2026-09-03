import { useEffect, useState } from "react";

import { apiFetch } from "../lib/apiClient";

type Persona = {
  id: string;
  primer_nombre: string;
  apellido_paterno: string;
  estado: string;
};

export function DirectorioPersonasPage() {
  const [personas, setPersonas] = useState<Persona[]>([]);

  useEffect(() => {
    apiFetch("/api/personas")
      .then((respuesta) => respuesta.json())
      .then(setPersonas);
  }, []);

  return (
    <div className="contenedor-pagina">
      <h1>Personas</h1>
      <table>
        <thead>
          <tr>
            <th>Nombre</th>
            <th>Estado</th>
          </tr>
        </thead>
        <tbody>
          {personas.map((persona) => (
            <tr key={persona.id}>
              <td>
                <a href={`/personas/${persona.id}`}>
                  {persona.primer_nombre} {persona.apellido_paterno}
                </a>
              </td>
              <td>{persona.estado}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <a href="/personas/nueva">Agregar persona</a>
    </div>
  );
}
