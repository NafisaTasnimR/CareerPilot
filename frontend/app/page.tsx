"use client"

import axios from "axios"
import { useEffect } from "react"

export default function Home() {
  useEffect(() => {
    axios
      .get("http://127.0.0.1:8000")
      .then((res) => console.log(res.data))
  }, [])

  return <div>Hello</div>
}