"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"

export default function Home() {
  const [message, setMessage] = useState("Loading...")

  useEffect(() => {
    async function fetchData() {
      const { data, error } = await supabase
        .from("test")
        .select("*")

      if (error) {
        console.log(error)
        setMessage("Error connecting to Supabase")
      } else {
        setMessage(data[0].message)
      }
    }

    fetchData()
  }, [])

  return (
    <div className="p-10 text-2xl">
      {message}
    </div>
  )
}