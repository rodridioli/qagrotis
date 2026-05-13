/**
 * Relatório PDF da avaliação de desempenho individual.
 * Layout single-page A4: cabeçalho · linha de meta · 3 cards info · 3 seções com tabelas.
 * Usa jsPDF + jspdf-autotable — sem dependências de browser.
 */

import { jsPDF } from "jspdf"
import autoTable from "jspdf-autotable"
import type { IndividualPerformanceEvaluationDetail } from "@/features/individual/actions/individual-performance-evaluations"
import {
  computePerformanceScorePercent,
  EVALUATION_LEVEL_LABELS,
  evaluationDisplayCodigo,
  evaluationPeriodLabel,
  PERFORMANCE_EVALUATION_SECTIONS,
  performanceScoreQualitativeLabel,
} from "@/features/individual/lib/individual-performance-evaluation"

export interface IndividualEvaluationPdfMeta {
  evaluatedName: string
  evaluatedEmail: string | null
  evaluatorName: string
  evaluatedPhotoDataUrl?: string | null
}

// ── AGROTIS logo (SVG→PNG 3×, 783×144 px) ──────────────────────────────────
const AGROTIS_LOGO_BASE64 = "iVBORw0KGgoAAAANSUhEUgAAAw8AAACQCAYAAABOBFfdAAAACXBIWXMAAAsTAAALEwEAmpwYAAAgAElEQVR4nO2dCZRdVZWwTyIOrYg4IQrYDrRilNQ791ZCSN4514TK26cqCKLUL6burTBoHDCGujcBVOxCFBV/bduplW7xF9uhRUBoJ1pYyCAIiggikwgigsxhDCSQxH/tVwWdoZK8YZ/h3re/tfaCBWvVO/fcfc7d+5w9CMG0xvIlO4siK0SeXiiK7F5RZH8vjeTZgyLPLhNFtlKMHfEifuUMwzAMwzAMY4siWyLybJV3J4DEkUhXizz7iBgfn84KwzAMwzAMwzCUFOknvBv8dm4jvi+Gh5/BysIwDMMwDMMwVDcOvo18u3ISKwrDMAzDMAzDdEv+zpdUJlRp67JOFEtiVhaGYRiGYRiG6YYi/WIAxr0DSS9gRWEYhmEYhmGYTjlq8WtEnq31b9g7cyDewsrCMAzDMAzDMJ1QZKf7N+gdSp7dIMaTHVhZGIZhGIZhGKYdxkbmiCLb4N2gdy1jo+9hRWEYhmEYhmGYdsjTX3o35P3cPtwtlo3sxMrCMAzDMAzDMK1QjB7s3Yj36kCkH2NFYRiGYRiGYZjtsXTpM0We/dG7Ae9XHhP5oXuwsjAMwzAMwzDMtshHlgdgvPuXPPs6KwrDMAzDMAzDbI3lS3YWRXavd8M9DFknxhbvzcrCMAzDMAzDMFNRZCcFYLSHI3n6U1YUhmEYhmEYhtmco0d2F3m62rvBHprk6UJWFoZhGIZhGIbZmCL9T++GephylRgfn87KwjAMwzAMwzDIWNon8nR9AIZ6mDKWjrKiMAzDMAzDMAySp+d6N9CDlvR2Mb70uawsDMMwDMMwTG9TjCzyb5yXQPLsWN+vimEYhmEYhmH8MTz8DJFn13g3zMsgefqw+OAhL2N1ZRiGYRiGYXqTFdm7vRvlZZI8+5LvV8YwDMMwDMMw7inS54ki+5t3g7xMkmdPiuXZG1hdGYZhGIZhmN6iyI73boyXUfL0DN+vjmEYhmEYhmHcUaS7NGP4fRviZZU8q7O6MkzYxAMDL4gVvLxfNfbYu77ohXEcP9P3mBiGYRimnBTZyZ4M79+LIjtJFNkSkWfDpRXsi8EwjE+m1epmRi2Bd8YKPhop861ImUulMndFyjwaafP3qUQq87jUcLNU5iKpzHekguOkarx9Zn3wdfg3+ZUyDMMwzOYUIzOasftuT+qvEUW6gF8GwzCd0q+NlHUzJjX8UCq4d2sOQqfS/JvKnB3rRiH1EOc2MU7Y05hnNx1hBQdG2ixFHY80fDhS8GmpzBcm/gnHoV42/79qvL02r9EXx/tz7yGmakzbOzG7x/XBebJuDpEacqnNR5prQMPnpTKfxX/HA6NYwbtiBYtwr+ZbZRcU6Y8cOw7fF8uWPdvJszEMUynQqJLanBAp80dqZ6EFZ+JP+LFCQ833PDDVYEaS7FhLYEAq+FikzLmRglsjDeu70NM7pDK/iJQ5Kao39sfwPN/PyDCtMnu22SnS5qBIw79EGi6QyjzY2TqAtZE2V0XafBVvo/dZsIDL6pMyNjrfcZjSz8V4sgPtQzBMuCRJskMzfAZDY1qQSMFPfY85NGbMGH6WTBqHRQp+59ph2KrgWBQcOXPhwueJgA3TidNpuACdrVZ1sBuJtLliQuC8SJvT8aRcajg61o3FE6fjnGeCIXGRNuNSm8ulMk/a1VV0ROBqdCbwpk4EwKz99nvxxPPDL5sOuQO9LIXUTdrNvA4PDz9DJpBJBT+Rylzf1rpV8CHhUR9k3SxrOgvaPGFrHUgFF0fKHFWrm5f6etZqMD4+XRTpFe5uHNKHxdjobr4fm2FcEik4tN2NrqYHB/ktTSQ4S22OwdNU787CVkRqc79U5sSZ+y7cJaR3hlf3kTJ/DnC+0Di4KlJwcq1uDkbDQfQAcu7AKyJlVkhtfut5/m+QCo6v6YF/8jIPGvaNNNzjWw+DFAVHdjqvfcmBO2PeVud6Af9XOCbSoKSCMydvCVzO85pIw/fi+tA+rp+5GoyNpm7DlUY+7PuRGcYleBLUUXiNMpf2+k3DhKEFD3n/oLf+zh5Bo2zu3AOe733+kmTHEB2HqQXWo76j4RQn+79EVIz+ZOGbpIZvOjeQWph3zBXCWHJXc9G3YNFuUpn7/D979ZwHvG3o5rddOg+RAsBbJ+/zPeFMn8NORDuML3mOyLNb3TkP6e1ifCknczE9RaTMSKebWqwbC0UPgrcueDrq+6PShdyNoQM+KzVhmFAA89DJh/yJSJkzYtWYLUpOTTXmYghipM0G3/PaglyCiaa256SZ7O3/WSvnPMQJvLn7tWffeZBJY0+pzY+8z/OWsgEd/FnJ0K6256D85OnRbm8d0kN9PzLDuGV8eqTguo43c2Uu6qU3hmE/kTZnBfAhIRI4Dz+WPuaym/CFcATOc3kqTny6/p2SOA2biNTwPzarik3mxHh/zqo5D82KQ2E7D9PwJnkiXCiAed6qwCpMrrY4DyXn2OzFokgfcOg4XN3Mr+iE5UteJYolcSll2WGclNPDSDX4jm43MzxREj0A3rJIbf5WPWPAPBIrs8T1fEba3OL92WlkQ6Tg1DJUSsHyqph0iu88gHnr6vYHS2BivhH1HIVvPJbTeYg0/FeozsPMfRfugk6p97ltby6+zWWPpyJPP+/01mHFaKMtbcsP3UMU2YmiyO5yOk76UK0LiNYfUzrGp0tlrul6E1PmfFFhsPJOs6Rkd6UpgxfXHyOpzV98PzOpKHggTsywCJQ4aewVVCUwEp01f4kTU6ecJ6lgne/nqqjz8IMQnQeJRRtKepAhFVwZzxt4JfWclJcVo68VebbWoQF9TlvjK9IPiDx93L/hT/b8b7H2LplgkRreRrWJUX/Aw6rn3Szn6f1D4eRjpM1vsdmRi7mtnPPwv/IlPOEXAVFT5ohtdTAvs0wa++NY+IFirth56B3noYY5PxpW+dbhrkTBX/FggHJeykuRnebQeF4nVozObHlsefox/8Y+ufNwHfe16DmmUZ5C4pWvqGLZyokGPn/vJcHQrL5kqGZ9fqvrPDRv40KoaDVnzvA/UISLlEEwh4YidIydh95wHvqSoRreFvrWWyK5O9aDe4ueZmxkjiiyDc4M5zz7RstjwxN674a+NXmv1ffKBIXUcAD5BpaYOaIiTIZ43BrAR8GTwCrb77PKzgOK1HDZnDmNFwm/Tc4u8T0Pjuf8Zmxu1828sfNQfeehL4FXSWXu8q2vpKLgdjl/6B9Fz1KkFzs8cb9HFOkuLZeNLdI/B2Dk25K7xMrDvZ+UMW6IFPyG/MOt4CdVeH/NUn0K7vT+MQghkdpiOFrVnYdJuSRJkucIx0waR9cH8PzORSq4txvHl52HajsP2J9HanN5NXXfXI+htqLnWDF6kDNjOc8eFWNZ0vLYimxlAAa+ZUlPsPp+mSCItRmytnklg/2ixMQKXs6lGjcxFB6ozWv02ZjrHnEemonoLvtpTCaABtvt3NGcr5ZJw3Q0f5wwve35VXBomZ2HSJnP+dZPuwI/8Nm/xz1Llz5TFOmNjgzlm8TY4tbjw45d/EJRpPf7N+6ty2PNKlJMpZEKfmVx8zpLlJS964teGGm42v/mH5bgLUx/fdFrqOe7V5yHCYHlwgFYeQUTKP0/bxgORCc9ONh52M7c1htxWZ0HzHPohfcrFfRQGDpWMLJ/sn6dyNMjxfuHdwy6bKxPybOvW3vHTBC9CixvXBtcJNtSkyTJDlKZX/je9LEiDoZd4O3HhJj7pTJP+h6XVPD7GUnS3r65HXrJeZg8CbfajC9O9n9Jr4YqbV1gVbuJpL1gXHYsCn7X6al2AM7DNFeNKaWGx6Q2t0UabmwW3VDwV/xvrt6T1PBQv2r0yEHwypFIrMgGrEiezhUrD3lFOcrGepd1bd3KMKVCKrjYweZ1uigZkYJPOP4Ir8F3IbX5ZK1uDu7XRm4rVhX7L8QKImzmhp1apYZfujdyaK/De8l5mJw/az110LGLFPza/zOGWT1splr46pb1kp2HrcwjrMY9qFMd9e082Ds4g/WTOYQfj5VpTCYtT7lPYgW2yWajJ0TKXGpV7xWc2elcMeUrGxuG5OlPWXmqR6wb8918sGF9f7LwTaIk1BIYcNEATirzODpWUjXejiU0KU6aa3pwVGr4obvbCbrwm95zHszfYwWLqOZvk7lU5js+ngdPOLE3iFTm+2jYTXavPirSZmms4YNSm2MiBZ/G8WH1KbxJ8zL3Cn7XauI6Ow9Tzt91NW1mdaOjvp2HSMFPiXV/tVTwlXi+eW2nY5J1M1Mq+HdbtxLYx6LTsTHdMDY622nZ2JAkTxey8lQLrD3v7oMN/yVKwKxkaFfbJfua1V+0GcfSmXZj3ZtdsK02PMKPXK1uZoTiPGAyMhqobYuC4/AGJ9LwdXToMNfFkQN2BXUyY6zgXU5vzJrOauMDaPhgl/p2x4ulVKU2h0+8O3jI1dilgn9rZXxSw9Ed6VRHekiwJyu4ztb4mo6gGlxA0YDPp/OAOVsYUkunS+YiyrKo6IDY+D5jKC7VGJlgy8YGJ1eJ8fY/DEyYYMlNZwZGU2A9Vn0RgSOVOc2esWIelwqOx5AjV88zGb7y6UjDWnvPBVdijkgIzkOcmGGamRNi5sKFz4s0KKnNZyIN99iaPwxtoBoz3vA5iaVW8GuZNA7rSw7cWRCCtwHNTvfK/IzSuHOhLxRIZU7s/t2Ys0UJ8Ok8yLoZo9IhqeHzVN3MN2Na0ymnDpvrMMGd6ZQ8Gw7AgPcrY+koK1A1kMr83LqBsYXAf4qAkXWzn7VnV+ZcGxWKWqWmB/5p0iCz8nxSQ14152Fj9jTm2bJuUoyXt6Ab36UaY6ThWstr+DwMdxQOmAjhaIZfWXMipDIP4i2dCAR2Hhw5D2TFMOB79Fqw+Vgbb6c9/An7O1wtjh7Zvdk0zbfx7l3S28RY97HZjF+wYZJdA2NrH2pYh0ZsiO8/juNn4nW/jWeW2nykk3AOC0yLFKy0EY4jNTzct2DRblV1HjYr3/ufxHP3WDww8IJux9bML7C1drX5C94I0Mxim8+VmDmYR9ELBR3YebDvPOAtAc3tHKxy1TFeavMWsjw8ZR7prb4Pvlg58npRpNf7N9wDkTw71vcrYboDOz9b/BBvzwj5fyG+v0iZFeTPq8yjlCEpVNTqJrGT19HdKVwZnAdbjaWkGnxHN+PBMoyob7bWLIZwCa+MT5/IS7FTUSyUdcrOg33nIU4aexHt7ycJh2AlPrI1TZifwWzOsmXPFvnIu0SRPeTdYA9J8uxBseywl7LClBPs+Gzj49u6kWSe9Bm+MxVoGEll7qN9VlglNewrAgU/oBZCcDbgKXEvOA+TtzinEM7d10LL1cEcHSwFLIJzfOFO8mfV5oYZM4af5fv52Hmw7zxE2hxEoTNxBw0Hu+89RNPQFSvziUqwPHuDtZ4ObfV/yEAUWSby7AuiSO/xbqiHKnn2Jd8qw3QGJtNRf3g7+FD/R0jvD0tI0neyHdpHBE7TgSAyxPAmoxmfrgYX9IjzILC8bqTMTTR6Azd2Og5M6qZfo/BwnMCbRYA0K9FouDnEvJ1uYefBwc0DUTWyuXMPeL5wjFRDuuuxK7hVVALs7lxkf/NuELO04zw82XT4mFKBnZ5dVDBpwVBaG8q16WSuw62keR0KDhQloTav0ddR/K8yj2D4G1YtmezY23UMbdmcByRSZoRIdzZ0aoyQ16tX5kG8oRQBEyt4uYUcpTsw6dznc7Hz4MB50I2CYI08KTzRbbI3VnASlaDIjmfDvYTOS56e4Vt1mPaIlDmD+GNrvca6bbCCDvGz/bMoGa2cxE0mWV8iFXwMT7rR6aIeRxmdBwx1oepN0Em3XqxIRHsgAGu7uT1ySV8CryIPvUsG3+3zmdh5sO88NPtVUKzX2F3J7Y2J6o39Ox0zhjdSlNX2T5HuIvL0Ye+GMEuHDkRW961CTOv13110TW5ZFKzZOzG7+35/UsHFhM91SVk35qkrCMG1UpkvYKWP2bPNTrbHUEbnAZloKkehP/B/2v1tbKxGuS6xQ7koEViznrSvhTJ/tFSzvyXYeXCRMG3eR/QNA+EBDJfE0Ni25kmZ+/DGxcahjx/y9N/ZcC+x85Jnl3HJr3KAHZ6JDBw6B0TBF33OSbMLM9WpLXbaTRp7ipKCzb6a5TAVnIoGpJw78ArXYyix87DUR8w9Ot+kZXcVnCpKCIZhkM3BhBzk71m4SZyDsKXFROv1f4QnIgX/ve3xwfpIwW9Qn7DIQHWcBiRfslczdt63AczSrQMRVIdOZkuwszOV0T9x0gnn0VVzgZf7emdU19edfsSYajgPMmkYIj0ab+d3sWcHlf5G2tzi4nbJEtMoy09LBWf6ehB2Huzvu2hM060bWC5CKfKh4PZImW/IujmkOtWUpiLPfsyGewWclzy7pVnWlgkWutAGWF+rmxlYhYVw8/0XX/MSaXMVjbFh7sOTe1/PURXK6jz0ayNJ9KhNQ0gquJJqHZYpyX+r+Q/KPE4yHwrW+FrP7DzYXTP/2+iRLE9oAzrxwjFYBrwZuqTMz7BoRd88eKPoCcayxLvRy0LoQIx48b6Z7YMdnQkbK51OnSuAG+DMfRfu4qPcI5XhFSn4hOvxV5HSOg/1Ra8h0qUvtXebSKO/UpnzRQWQGj5FNifaHO7lGThsycmNL2WFvWgyEXlWMrSrcATm1iVJ8hzRY0wTRfobNt4r5MDk2SoxdoSTNu1Me2B3WKINcgOesFoI1XDeqXNyXg6nGT+s9ZEfUEXK6jxQNV5Ew7Hl39TmBKr1V4aeJK0QDwy8gKryVaTMuT6egZ0HZ87DyWTfL/30t2AV3gL478ZeVfJ0xLuxG4rk6WpRpKeIFdliUYxqUSyJSyvLl3DYRmDgiShVQqXU5keb/31MyCL6UD/iOkZTavgm0QfjBy7HXWXK6jzEChbRrDE4utXflNpcTrT2LhUVAsMgidb1Wh+lONl5cOY8AI2emC3HpOBeqeC4fRYseBm9hvQq40ueI/LsVu9Gu3/ZIPL0M3xaz9gEOzmTbYqJmbP538c4aboNt/VTVwowQdRXeU2mWs6DrJtlROtgaSu/NyNJdiQ7FFCD7xAVYiL3gShM00O/C3Ye3DgPzeag2txB9f2KphybeQJ7K8XaDJW1hHc4FNnKAAx3/7cNefpW36+CqTbYwbm5edm9wscqJ7+n2WjhIUxkczE3WOKSaMyr+YqajrI6D1Qdnlsde6xMg2rN+e6obAPM4SCZHwXHexj7iQT79dmiBOCtrc8qdxSdpqOWdcnch4d5uHbZkWiXY7MXiyJ9wLvx7lvG0rd3quwM0yqRNl+l2viwtN3WfgdPLuk2WDcfa6p8DZ91vqtIGZ2HyVsAkio/sR7cu5XfjLT5OJH+ftv+DLkn0ub9RAbfL1yPnZ0Hd84Drt1Im7upvl9R63rFjkRb5OnnvRvuviXPvt+pojNMWyfrCtbQbHRw8bZ+C7uxSm1uINlYFTyASY9laSrl42SyypTReaAKWcIuya2eSOJNII3+Nip5kIW9YyhKceLNohDj012OnZ0Ht/11agm8k+TbpTvVMXM/FjWR2rylF6snbZ8ifbUo0jU97jisFStGX+v7VTDVBzs3k21wCmB7vxcrs4RsM1VwnO35kcr8q6u5YarrPGCSP9XJpdRwmct5QuO6VjcvFRUl0nAjxXvBLvQux83Og/vmnBjmFVF9L7vbAx6ONHwPnXofyfphUmSneTfefQsmSDOMg1M3wmZJv27lN/HElCoBGa9058494Pk254iqG23fgkW72Rxnr1Em52HGjOFnSW3OITMcFHylld/F00mSbvHK3CQqDFk1NcdJ0+w8uHcesCGgpLo9p9oPsAGchh/U6ubgKuYltUaR7tOsLtTbtw7cB4EpWanC9rrOYqUYqt+NlTnW8hxd2/XmrszjrkManh6/MkdJbY4JQupmWU2bWb3kPDRD9ZQ5jdJYqOnBwVZ+GzvJEhknlcx3eIo4Me8jmScF73E5bnYe3DsPyMz64OukMndRrmnS0CYFX6lKP5bWKdKLvRvv3iUd62juVizZVRQjbxYrRg8SeTZcOnn/8I7k+sRsFezUPHFiQbFpwdXNho4tgqcjkYK/Ev32PTarGEltbuveqDDXC09gbojvD9oU83ERVviquvMgk8ae+Ky08wf3tJrvENcH30rzvqqdr1NLYIBknoiM01Zh58Hf+5F66A1SwZ2+99JtioLr8MCm+lX+0Oj1brh7l5vFsmWtXzuNj0+fML7TCwMYe3eSZx+3ql/MJmCnZqpNqpP677GGD1L9PpbRs/V6sRNo9/NjLrI1vjI6D5Mftr/OSoZ2raLzMJmEO07nnLcfskR5w4d5SqLCxPPNa2l02nzL5bjZefDr3PVPNFa9xvteut09w9yHBwDVzFsaT3YQRXqddwPWu4y03kRq2chOIk/P9D9mMnlM5IfuYVXPmP9N3lTmEaKN6fpOQnLmzBn+B6qrXzwBwr9n4/WS9L9Q5mfCE8E6D10aW2E5D+PTa3UzY7IYwOlkPVNabMC49TmCnOI34wTeLCrMZBMwiopLP3Q5bnYe/N8MzZ17wPMpelC4EDzMkNp8GQ83RGXI0yMDMF49S3p5y6EfY0e8SBTp9RWcg1Os6xpD89GZlJoeHO10SqWGo+k2R1huI9GVaHynC0+E7TzAmk6v1G04D6hDkYKTW5BTpIIzscGYVHAlNlBzM2dwYVvvXpt/pvjdWEEkKg7JLdHWG2TaGTM3iQsmrKymB0eD3ms31dNHpDYfsXXg5g48QS/Se/wbrl5lg1g5olqes2rdOGws68TY4paaHzGdgZ2ZqYwdqeHmbjpg4qkNXqkSbYp3UNe+xhJ4JPOkjLeeLaF/0Pq1kaE4D3Fi6hQn0LYk1o35PkIT46Sxl6g4mEvS/TqHX7kcMzsPYeWk7LNgwcsmK3cFu4dsOh/mBqlhX1FaiuzEAIzW8py45xn4H69V8Rbi0QtIBR8j3ICWdjueWMFHycaj4EhByzSpYB3BJv1j4YnQnYdIQ+uHJg7ClqQ2/+F/TqbQIQVndjBHXy5j/wIfRApu7f4dmWtcjpmdhzAT2vu1kZEyZ5CUSba/r6yLFHwCq8KJUnH0yO7NWHf/Bqs/wWTnsRavj/AF5+nVPTAnC63rXg8ye7bZiSIBuCkK/kpRUxq7RFMZuFgZCUONBCETzXi6NirOF55g56E952HOnMaLqJq50X3gzYOdGPBUpZgxoVhUHKnN3wjm6gqnY+awpaCrYfVhqWRlviWVedL3HtLCHvOLciVUF9mp3g1Vv3KyGG/D2MmzwwMYswu5qllJiiEFOzJTbTZYLSnEHAyK2xBqowLj4oUn2HloP2G6Gb8cwAf9af2pm0M6efdSmxOIfn+mqDjooHU/V3CB4zF3v28qc7YoAWV0Hp6iL4FXNdciWXlyWwLXliOZeiztE3m6PgBD1bU81AxTyrP2Yn3Hlz5XFOntAYzflVS6PKBrmvkF2txPYkwocxdlstVk9adHSTZAZf6M1VOoxhYp88fuxwQPUI2n/fFz2FIH1Zam4W2R/4950+D5fKfvHhvzEY2hxHHRrUEUnvgjt2Nm56EMzsNTYGhQVG/sjyFN2DjU994ytcCNfQsW7SaCZuUhrxDFkrhnBJ0lDNPq9ES9SI8LwKB3KOltLYdzMdsFOzETGjRHU095pMzn6MZnDqcaF17nUowJw2FESWO5eynn4SkwSRirQXmem+91E4uMOUA06wneJireMJPqfbkcNzsP5XIepgjXPVRqc05oYU14U179xnK9QpHuMnFj4dugd+5AfMj31FcB3AgoqolMbCzmvhlJQt4NHK9LyU5jlLmpmypQNhJofZ3eSmVO8/0xKqPzQBn206G+fLvbJMZImZHQmzCGQFwf2ofovX3V5bjZeSiv87AxeLA02SPmLKnhMf978tPlxVtrHcAETJF+zb8h70Hy9GHxwUNe5nv6y06kzAqqTQWrI9kaJ1V1mG77T9joRYENu4QHQi8/GrLzgKV/0RF1PicKTqWofoIOq+uu1mWklsA7id7bSpfjZuehGs7D5gd9tbo5ONLwX1SNXDte90njsE0Gx5SMfMleIs+e9G7Ie3Mgsi/5fgVlZqKTM9xJY0SYB/uSA3e2NVasKBNpWEsyVm1uIDLA3kZjWJgzaGapg2dQcLzPj1BZnQck1o2FruYCb96kanyA6sQPq6fQrCX4pagwZP0w6oNvdTludh6q5zxs/u1GncJbSJqE/nbny9yPvSs2GRRTIor0HO8GvFdJnxB59jrfr6GsNLvm0hk3JzoY79epxosniiTl9kjGA/f4rKUtE8goDO5ecx6QSJnv2p4Hqcz1tXmNvk7mwnbCPDo1FGWZQ0UquJjiHfYnC9/kdtycMF1l52FjcP1hsnWzCZ3DGwmp4N82GQhTEvJsmX/jPQDBjtpM2zTDLrS5g2QjUeZRrIpk+zXIpLEnXQIZXCtEtyV/x6eTVamqm/2EX6ahgVNLYIBKYm2Gqu48zEqGdrVWtUqZR7Bxo60ExUjBb0h0t6IVl9Aoo8m1gvWUFehagZ2H3nEeNq+ciCXJqdb2NudMmcdx/9tkAEzg5Fkuimydd8M9FMmzuu9XUjaoqq1MGjmfczVuvKalGnerBuK2wFroROP5mqimg1pp5wGJE/M+0o+yNk/gqZ7tDzPZTZ6CT4gK0r3zO/k+lbne9djZeehN52FjosTMkQp+Qrk3+Yg4YCgo0jeJPD3Du7EenvyKs/9bBzstY8dlsk2keVWK3anti9Swmm7zg6u71RusNkM0llVVK4HXK85D8wZKwa/o1hOcLBxA1fAOc4hEBYkUnFLWgwF2HtrV4eo5D08hk8H+SJlzyfanjedNwZ+EN8ZGdxN5Nsyy1Tk4XOTpuMjTCwMw0sMVnCumJZrXmhY2kjJKt4mMNW1m0W3EzYTYytA7zoMQmJNAFVKHf6cvGaoJB91tqXTXRi7qZpgAABQ1SURBVE5GACFL95HsMbqx2PX42Xloc81V2HmYZFpNmSNsJFf76zJfZGd7NzxZyj8HeXaLWLassol7VGCHZey0TL2BlFWkNr/t5vYBE52lNn8LrQdFCPSS89D8XWU+S6iXl3efk9PCmIkS5bHniagQWIqS6l366MrLzkO4zsOwx+IY/aqxB37zqHR7cu0f4/5JilHt3ehkqc4crMiOcq/E5QI7LFNuHJWQemP/ruZUmX8l24grdPuAxn8vOQ/YIJG0apWCI4VlmhVaKPRWw2MuiiY4YppU8Hua9wg3+ngAdh7CcR7mzj3g+VLDARO9iuDGWMMHbf1W6+Mxl5PtU467pyPTRJ5e6t3gZKnOHOTZKjF2xItcK3JZwFNtL42tApeJU94gutA2u3RjV1FRfqZFCn7dS84DUlNwIKEuPCjnDrxCWAQdZ7K1pODTogJgKCPhnHhJJmfnwZ/zMDw8/IxYNWZLBcdFGi7EAgihNVacue/CXaQyd9FVLnRJkR7i3dhkqd4c5Oln3CpyeaBKkKyiyKRhujyp/BOhwXGqKDlSwXsIPkqlcx6QSJuzyPRSmdOE5TBGqth+LN2IeRSi5MUkImX+SPX+sBeMj+dg58Gt84BNTGMF78L1ur3y3VLDZSIAsL8P0bp/0l3BmvHhZ4k8/ZN3Q5OlenOQZ2vFUYtf40aRy8NkbP4NVB/FCsol3cxvrOCjlOOhaGLnC0ygwzCWXnUemt3QCZs1YclQYZFIm68S6u7posREClYSzsVVvp6DnQf7zsNE1ULI2/2uSm2eCKGy3kQkAtxOoeuzZ5ud3Iy6yArvRiZLlefg224UuTygMUr4UaykdNOobdZ++70Ym+WRjUWZB32dWnZDPDDwAionFStZldF5oC3h20yk/3Mc7/9cYQmphjTxOkpFCYn14N40TeF8JpJOwM6DXeeh2dVZwwWdr2kAEQCRMt+g0HU8MLE/2mMXv1Dk6X0BGJgs1Z2DDeKorN++MpeF8ekYl0hpIFRT4MJQEqcnPmjmLz4qtXTZ3fQSkmdXcGWnV+EhOA/NUz1triLTB2VOEvaYhj1PyPRWmQdnqoWvFiUCO0BLZa6hW7uwulY3L/X1POw82HUeup1faTkcsVViZY6l0Hc3B115+tkAjEuWVhOQSyvpGfaVuRygIURmxFRcanWTdDzP8wZeuXlyXLeCBo3tTsMU4DW8VOYisvegBwc7HUsIzsNTHV4jDevJuk5brKceKTNCvJb+0JccuLMoBePTI2XOIH1+BV/0+UTsPNhzHiZvHVZ1ua8/6ea0ftvIullGoe/xfPNauyMt0leLIl3DxnuwzstjIs++LvJ0bjMvhakCpKeK1Rc4r5vJjjR8nXpMUsPN9jfnztk7MbtjEiDZ8ypzUTfjCcV5IM8nUOZSW70fJiuxkfZ/kcqcj4aWCBwLN4ZPyPlD/+j5mU4k0LezRQmINPzApfOAp+w06wO8V12S2pxA8Sz2yzQX2XcDMJBZpp6DH4oi3cWuAjClLjvYIxLXB+d1Ot/7LFjwMhtdPCNt7o51Y6EIjFg35uPYSOc/MfWqOA94+i4V3Ek1N1LBe0Xgp5CbiDLnYv8LEeyNA3zRwjN/y/eTsfNgz3mQGval0RVY3+1e1y2Rgp9SPAcmj9sbZTEyqxmLzsZ7eM5Lnn7FXaktxiHTqLtJ9oJIbc7pZtIjDcvtjA3WS20+aXejbg0cA1aYwut30mckOO0MyXkgL1ag4AFbYWzYEZy05PDT6wkuQ6daBMTEs5rvkD+rMo/31xd5r/bHzoM95wFzWSJtNhDt6Tdivo3wAPaQodi/8Wbc7kjz9ELvRjLLVHNwnvDYLp0pSQOoHhNs/NZNCAhdh9qpNmtzg89qHdgTw04CPqyiaIoWmvPQHJMyPy9DR1epzVss6ezf4gTeLAJgZn3wdaTJ7Bs/p4LjRQCw82A3YRpDCAn15iz8ZgjHSAUfI1rbP7I3ynzkADbcA+2JMJbuae/FMz6hbUHfWyK1+XF3cw/7kp/Kby4KftpNgncHHaOhq/KE230eM0Ix0CCdh6SxJ2UZUJvOI+q+lTWlYJ3U5jO+wpiaTn3dLJMaHrakw7f4OkXeHHYebDsPcCjt2jDfsZXPNBWxgihSsIZo/B+3M0o81c6za70byixTzEH6OTsvnfHNxOmwlQ9kr8iGqN6Iu3kHkYIPuRgrOonY3XTOnMaLBDFYKrbZs0DBdVafQcGZVGMO0XmgbiSIoQK2DFVMzid1dDYXBX+NdWMxNq4UjsAeLrZuGzZ6JweIQGDnwa7z0Cztu51O0lHb68J814XzGSt4OWUXdXt5G0X2fjbcQ3Re0gfEsdmL7bx0xjdU9fabG6sy50caPoxNj0IWHCPldbLU8MPu3sL4dMyfsGmwbDpe80SkzM+wSy7efMRx/Mx2R4wOCCZmRwo+MVFBiabU6Hb0666Z+y7cperOA1YekspcT/i+PyksIVXjA9Z1VpmbpIL32GqANxE+2Hi7kxtYZb4hAoKdB/sdpjFEjX4vhCv7k4VvsqMVzXyNGZGCW+nGDKvshFy9f3hHkad3+jeUWaaYg4L+hTMhMHnKRmSgwC99xGN2ZaBpcxvR82+ozWv0dTMeNIox3tu68TKlQQNrMD9CKvgJVpWRGj7VdLTQMFSwEm9GMIwkUnAqOogURncH+vVYN/klZXIeNqpOtYHKWbTZnIm898FW9dQ8IjV8G0/usdFgt4nQOMdSwb9FGu5xpMd/sNkBvBPYebDvPMQDAy/ott9DNKXAWtyXKW+SJ7+Lx1CH7Elt/kNYIc8+zoZ7iI5L+mexbFn79bePGn2jKNIxkWdfEEV2cvkkPU70ANgpmWpzqCUwIEpGpOBIwo38B92ORyaD/RbjrEsssB5PhmneejmcBwSdNUrn3lalPCwzS937YbvPg3lCCn6DvRfixLwvVqbRPxdejxVunsqVwNCOWfvt92LMI0FHAUP2sAM39gexGm419fyvdtNdtz3YebDvPFB2aI6mHtNDuA660S+schYpcxSGOdoYI+ZOCHLGRncTebrav6HMssUcrMgWt/Uu85H9RJGeX4m5HBudLyoMJtDSfcjhV6KE4OljpM0dNPMA6ymMA3TCCBPUqiHKrBAWCN15QEOYNF46GXy3rbHGqjEbb4e860qYskEmkIkAYefBjfOAJaub1e8s65ps3iCbL2DZZ/wezVy48HlTjaWZo6ZgUaTNP2PIrNWiHc2mlTYo0lO8G4osU906/KaNk6ppIs8+Xa3+HOkVYtxdVQPXYIdkqs0BNyFRUkh7LSjzXYoxoUHqIoegDIIfQmGJ0J0HpHlaTjWX2txPmTMyVcln65XDSigYBiIChZ0HN87DRmHCRH0fTDtjfmiyQecdeAPm+vftlF5eMTpTFNk6/4Yiy5ZzMNL6Cy/ST1VyDvOUpCRkaNRUYy7ZxqTgyjI3DmxWw1DmLqK5WBcnjb0oxiWTxmFsiNkq7Vce56HZwFHBxYSGxLdtDramB0d9GEihilTmsyJg2Hlw5zxMzvcXfOtk5FbOElYo0nO8G4gsU81B69Vj0Mmo1I3Dxs5DdqsYX/IcUTEoK/tIDW8TJQfDYsg2S2W+Rdq8T5lHA/gAuJYNGH8rLFMS50FgVZVmhayS5Cc1S/b61yHvIjV8M/SDFXYe3DoPk6GyV/WE/ivz4Ey18NWCnCJd4N04ZJliDtLbxbLDXtrSO8T620X2+4rP40pRIbAnAd3JIFzrsmGNLTAudPJal2DDhHXYmZZqbDVtZlGNrQwy2SDscOGAsjgPSKTg02TzrMxNaMTYHG9NmSN6+uZMwRfLsDey8+DWeUD6EngV1W130ELUzHNTMJa8yK4KwDBk2fSk/W4xNjq75feYZ4dXfw6r1ecCW8RTbQ6YlCUqAmk1DOJa7lgtJlLwO+8fA/tyh1RDmnLuquI8YIlP7ExclpAwJNLmoB5Mot6A5Y1FSWDnwb3zgESJmVPltSEV/LuwQp4e6t8oZNnMSD5fHD2ye8vvcHzpc5u3FL0wj3n6eVEBmq3m6W4dbnTZ+dU2WDeeqrINhphQX9dONg7718rGkytzrs1k3rI7D0iszRBtjfihN1gfc2LqUpn7vOuXEx2GNWU7UGHnwY/zgGCTzSo6EHhAaafn03iyg8jTC0WR3cziew7Sy0WRfVmsHGm/Bm+efdS7Ue/MecjWihWjrxUlBzshE34oDxUVQyo4jnB+TrYxxonyes6aWjn40MBqjJH3EeJRNucBwX4idPMPF7qIyY/nDbwSeyv41jWreqzM9X3JUE2UDHYe/DkPTzkQVcprwyaioTVCZEKiSHcRRfaQd6PerZwmSgzWfKYq/4lGF9aKFhVj9myzE1UnULx9kPOH/tHGOPeuL3ohVu0oe0y5VOYXlPkhveA8xApejomIZO/AUX4J3lJOdK6lS/wORpT51lON6coGOw9+nQekNq/RJ7W5zbsed72XwA9t51IxZadIvxaAMe9eViyZJ0oK5YmlVPAeUVGkguMJ5+krVsdaNzMjDReU7yNjbnBtdFfFeUBiDR+k01FzHzajczb2iTCm633rIJHcUaubg0WJYefBv/OA7J2Y3bGZWgA63YHAeqnhU2UoEMD4ZOXI60WePendkPcjvwq99J7tW4dIwe0Yfy8qSvNUf6KpDsVcrcFOnrbHLLV5C2UvAFuCxjqedNuJh22fSMPVZXQe8BQ/0uYKsnej4FSX44/j+JmybsYob1CcioI1UptPlvW2YWPYeWj3/cOHbb2LJEl2kNqcgBXnvOt4iyIV3ImhV7bmhKkSefbfARjxHm8fRg8SJQM7H9NtGLBcVBySD6qDDslbjFvDvlLBmaF1p0bHRqrBd6DRKAICK4J0+2y+blBkMthPaGRsiNTgAtfPgAny+A7KE8rUXFenx/NN6fPfnoKdhzZ1wME6ieqNWGq4rARr4Wuz9tuvMpUoGZsUI4u8G+/eJb1RLF0alBG0LfrnwuvpjAy4ETsyi4oTJ/u/RCq4l2LOsJrGrGRoV5fjx1wLqeFo7P7t7eOi4HZ0nEJOIsWwr27Xhs/wq8nqW1TGwI2+bhT7VWOPSJnPSQ0P+zWItqrLayIFp7ioTuUadh7a0oWr3IXmjE/HoiRSw83e9X+L9WDOxcqNbuaBKT9HLX5Nsw+Ed+M9BEk/IEoCJvMRGRer8LRT9AgyaZim0UAwd1KZz3p2Ho/DKhhY2chqczcFV+Kz1lRjblniX/EmrZvytz6dh8nyvWRVjDDfR3ikLzlwZ+y3gjkxgYTZ3YbhSZikLioKOw9t5QbNcP1+Ygzx0+Zwqcw1XtcCHrIocwY2LXU9B0yZKUa1yNM7/Rvtwci94pjhF4jAweZi3VfkgfWRgv9GI1T0GLhRkhhnyjzqMil1Wx8iNOyx6k0zlE3BrzupLjURZgLXYggHNhvD8rHxwEDw62FrxPXBt3ZqsPpO/EYHArtPk+QPKFgTyjrv10ZGypwUKbjVsaF0t9Tmy5jYXRYHuBvYeWjJaD6bum9Px8UGNHyTqiJgS3s9Oi0KVsq5A6/oaNBMj4L9H/LsGz2cIL11ybNPisDB+uq1BAY6FYyh55hGITDpOdKguplL16FL7YZpYZwtjhMN6Vg3FkfaLH1alBnBmxg06DDEJLTcBSpqeuCfYt2Y38573WfBgpeJAMBwQiz52I2ONt9/ePH80/qThW+KFBwZafgeVjiiNY6a4YlnNRO4k8H+KjW+bPWAqVudQb0TJQDDFNtaC/XBebg3isCI8TYiaRgMW5y47aVMsIZ7MG9OKniv371gfPhZoshObdbIZynRHKQ/EXl2i3cDPWx5TOSH7uFvcTEMw/QemNODFV7ixLwPcyXwZnTiFs38IdLmlmaIZTNED1Y1by4UXIfVqaQ2P44UfFHWzbKaHhxEw7mM1fMYZmPw1hcPt9Dgb/b/wWawylyK+RIT3d1h1UQEQvPG4u6J/w5X4rrBcuKRgg9F9cb+WC5WBEORjgVg5LHwHFi6fUi/6XuJMQzDMAzDVIPlS3YWeXofG67svFRWB/J0vSiWxL6XGsMwDMMwTPnJ0896N+5YeA6s60B6vu+lxjAMwzAMU26WL3mVKNI1bLyz8d4TOjCWGt9LjmEYhmEYprwU2Xe9G3QsPAfOdCC9TownO/hedgzDMAzDMOUjz+RELDgbrzwHPaQDeXa476XHMAzDMAxTPorsPO+GHAvPgXvn4Q5RpM/zvfwYhmEYhmHKQz5yABvubLj3rA7k2Ud9L0GGYRiGYZhygJ0Zi/QP3g04Fp4DfzrwiFixJNhOwgzDMAzDMOFQZO9lw50N957XgTz9qu+lyDAMwzAMEzbvH95R5OmdPW84svPAzkORrRNHjb7R95JkGIZhGIYJlzz7OBvObDizDjytA2f7XpIMwzAMwzBhsuywl4o8e5QNR3YeWAc20oEV2b6+lybDMAzDMEx45CMfZqORHQfWgS0qL33P99JkGIZhGIYJjzy9lA1Hdh5YB7bQgYfE+Ph038uTYRiGYRgmLNBIYuOZjWfWgS114Jjslb6XJ8MwDMMwTFgU6RNsOLLzwDowVdO4JXv5Xp4MwzAMwzBhUWQ3seHIzgPrwOaOQ7peFOnzfC9PhmEYhmGYsMjTM9lwZOeBdWAL5+FPvpcmwzAMwzBMeKwYPYgNR3YeWAe2cB7GfS9NhmEYhmGY8BgefobIsz+y8cgOBOvA02VaHxUrluzqe2kyDMMwDMOEyVjaJ4rsMTYe2YFgHcj+LsbSUd9LkmEYhmEYJmyK0YNFnq5m45EdiJ5Oks6zj/heigzDMAzDMOVgxehMUaRXeDfiWHgOnDsO2a2iGFnkewkyDMMwDMOUjzydK4rsyyLPLppwJgglT68WRXYzC8+BVx1o5vmkl4siO1Xk6VubuT8MwzAMwzCM2Bb/H5kj4Nn+cY1vAAAAAElFTkSuQmCC"

type DocWithTable = jsPDF & { lastAutoTable?: { finalY: number } }

// ── Layout constants ────────────────────────────────────────────────────────
const PAGE = { l: 12, r: 12, t: 10, b: 12 }
// innerW = 210 - 12 - 12 = 186 mm

// ── Colour palette ──────────────────────────────────────────────────────────
const C = {
  pageBg:    [248, 249, 250] as [number, number, number],
  card:      [255, 255, 255] as [number, number, number],
  border:    [229, 231, 235] as [number, number, number],
  shadow:    [218, 220, 227] as [number, number, number],
  brand:     [0,   115,  93] as [number, number, number],
  brandSoft: [237, 250, 246] as [number, number, number],
  brandDark: [0,    84,  68] as [number, number, number],
  text:      [26,   32,  44] as [number, number, number],
  muted:     [107, 114, 128] as [number, number, number],
  faint:     [156, 163, 175] as [number, number, number],
  tableBg:   [249, 250, 251] as [number, number, number],
}

/** Pastéis de preenchimento por coluna de nível (Não Atende … Excelente). */
const LEVEL_FILL: [number, number, number][] = [
  [255, 241, 242], // rose-50
  [255, 247, 237], // orange-50
  [254, 252, 232], // yellow-50
  [240, 249, 255], // sky-50
  [236, 253, 245], // emerald-50
]

/** Cor de texto por coluna de nível. */
const LEVEL_TEXT_COLOR: [number, number, number][] = [
  [185,  28,  28], // red-700
  [154,  52,  18], // orange-700
  [133,  77,  14], // yellow-700 (amber)
  [  3, 105, 161], // sky-700
  [  4, 120,  87], // emerald-700
]

// ── Helpers ─────────────────────────────────────────────────────────────────

function formatYmdPt(ymd: string): string {
  const [y, m, d] = ymd.split("-")
  if (!y || !m || !d) return ymd
  return `${d}/${m}/${y}`
}

/** Cores por faixa de pontuação — idênticas ao web (scorePercentToneClass). */
function scoreRgb(pct: number | null): [number, number, number] {
  if (pct == null) return C.muted
  if (pct >= 90) return [22, 163, 74]   // green-600
  if (pct >= 80) return [37, 99, 235]   // blue-600
  if (pct >= 70) return [234, 88, 12]   // orange-600
  return [220, 38, 38]                   // red-600
}

/** Cartão branco com sombra suave e borda. */
function drawCard(doc: jsPDF, x: number, y: number, w: number, h: number, r = 3): void {
  doc.setFillColor(...C.shadow)
  doc.roundedRect(x + 0.4, y + 0.4, w, h, r, r, "F")
  doc.setFillColor(...C.card)
  doc.setDrawColor(...C.border)
  doc.setLineWidth(0.2)
  doc.roundedRect(x, y, w, h, r, r, "FD")
}

/**
 * Define um caminho de recorte retangular com cantos arredondados via operadores PDF brutos.
 * Deve ser chamada entre saveGraphicsState() e restoreGraphicsState().
 * Usa `W n` do PDF (Clip path operator — não preenche nem traça).
 */
function clipRoundedRect(doc: jsPDF, x: number, y: number, w: number, h: number, r: number): void {
  const S = 2.8346 // mm → pt
  const pH = doc.internal.pageSize.getHeight() // mm (unit="mm")
  const x1 = x * S,        x2 = (x + w) * S
  const y1 = (pH - y - h) * S, y2 = (pH - y) * S  // y1=fundo, y2=topo (PDF: y↑)
  const rp = r * S
  const k = 0.5523 // Bézier kappa para arco de 90°
  const p = (n: number) => n.toFixed(3)
  const path = [
    `${p(x1+rp)} ${p(y2)} m`,
    `${p(x2-rp)} ${p(y2)} l`,
    `${p(x2-rp+k*rp)} ${p(y2)} ${p(x2)} ${p(y2-rp+k*rp)} ${p(x2)} ${p(y2-rp)} c`,
    `${p(x2)} ${p(y1+rp)} l`,
    `${p(x2)} ${p(y1+rp-k*rp)} ${p(x2-rp+k*rp)} ${p(y1)} ${p(x2-rp)} ${p(y1)} c`,
    `${p(x1+rp)} ${p(y1)} l`,
    `${p(x1+rp-k*rp)} ${p(y1)} ${p(x1)} ${p(y1+rp-k*rp)} ${p(x1)} ${p(y1+rp)} c`,
    `${p(x1)} ${p(y2-rp)} l`,
    `${p(x1)} ${p(y2-rp+k*rp)} ${p(x1+rp-k*rp)} ${p(y2)} ${p(x1+rp)} ${p(y2)} c`,
    "h W n",
  ].join(" ")
  // doc.internal.write exists at runtime but is not in jsPDF's public type declarations
  ;(doc.internal as unknown as { write: (data: string) => void }).write(path)
}

// ── Entry point ─────────────────────────────────────────────────────────────

/**
 * Gera o buffer do PDF em memória (Node / route handler).
 * Todo o conteúdo é comprimido para caber numa única página A4.
 */
export function buildIndividualEvaluationPdfBuffer(
  ev: IndividualPerformanceEvaluationDetail,
  meta: IndividualEvaluationPdfMeta,
): Buffer {
  const doc = new jsPDF({ unit: "mm", format: "a4" })
  const pageW = doc.internal.pageSize.getWidth()  // 210
  const pageH = doc.internal.pageSize.getHeight() // 297
  const innerW = pageW - PAGE.l - PAGE.r          // 186

  // Fundo de página
  doc.setFillColor(...C.pageBg)
  doc.rect(0, 0, pageW, pageH, "F")

  let y = PAGE.t // 10

  // ── 1. CABEÇALHO ──────────────────────────────────────────────────────────
  const headerH = 17
  drawCard(doc, PAGE.l, y, innerW, headerH, 3)

  // Logo Agrotis à esquerda (PNG 783×144 px → escala para ~40×7.4 mm)
  const logoW = 40
  const logoH = logoW * (144 / 783) // ≈ 7.35 mm
  const logoX = PAGE.l + 4
  const logoY = y + (headerH - logoH) / 2
  doc.addImage(AGROTIS_LOGO_BASE64, "PNG", logoX, logoY, logoW, logoH)

  // Título centrado verticalmente no header
  const midH = y + headerH / 2 + 1.5
  doc.setFont("helvetica", "bold")
  doc.setFontSize(11)
  doc.setTextColor(...C.text)
  doc.text("Avaliação periódica de desempenho", pageW / 2, midH, { align: "center" })

  // Código à direita num box com borda verde (equivalente ao badge do web)
  const codeStr = evaluationDisplayCodigo(ev.codigo)
  doc.setFont("helvetica", "bold")
  doc.setFontSize(10)
  const codeTw = doc.getTextWidth(codeStr)
  const codeBoxW = codeTw + 8          // padding 4mm em cada lado
  const codeBoxH = 8
  const codeBoxX = pageW - PAGE.r - codeBoxW - 5
  const codeBoxY = y + (headerH - codeBoxH) / 2
  doc.setFillColor(255, 255, 255)
  doc.setDrawColor(...C.brand)
  doc.setLineWidth(0.5)
  doc.roundedRect(codeBoxX, codeBoxY, codeBoxW, codeBoxH, 2, 2, "FD")
  doc.setTextColor(...C.brand)
  doc.text(codeStr, codeBoxX + codeBoxW / 2, codeBoxY + codeBoxH / 2 + 1.3, { align: "center" })

  y += headerH + 3

  // ── 3. CARDS DE INFORMAÇÃO ────────────────────────────────────────────────
  const nowStr = new Date().toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })
  const infoH = 30
  const cardGap = 3
  const cw = (innerW - cardGap * 2) / 3 // 60 mm cada

  // Card 1 — Colaborador
  const c1x = PAGE.l
  drawCard(doc, c1x, y, cw, infoH, 3)

  // Foto — retângulo arredondado (rounded-xl do web)
  const photoSize = 18           // mm
  const photoX    = c1x + 4
  const photoY    = y + (infoH - photoSize) / 2  // centralizado verticalmente
  const photoR    = 3            // raio dos cantos, aprox. rounded-xl

  if (meta.evaluatedPhotoDataUrl) {
    const raw    = meta.evaluatedPhotoDataUrl
    const isJpeg = raw.startsWith("data:image/jpeg") || raw.startsWith("data:image/jpg")
    const fmt    = isJpeg ? "JPEG" : "PNG"
    const b64    = raw.replace(/^data:[^;]+;base64,/, "")
    // Clip para cantos arredondados via operadores PDF brutos, depois restaura
    doc.saveGraphicsState()
    clipRoundedRect(doc, photoX, photoY, photoSize, photoSize, photoR)
    doc.addImage(b64, fmt, photoX, photoY, photoSize, photoSize)
    doc.restoreGraphicsState()
    // Borda fina sobre a foto (aparece depois do clip restaurado)
    doc.setDrawColor(...C.border)
    doc.setLineWidth(0.25)
    doc.roundedRect(photoX, photoY, photoSize, photoSize, photoR, photoR, "S")
  } else {
    // Placeholder: quadrado arredondado verde + silhueta de pessoa
    doc.setFillColor(...C.brand)
    doc.roundedRect(photoX, photoY, photoSize, photoSize, photoR, photoR, "F")
    const cx = photoX + photoSize / 2
    const cy = photoY + photoSize / 2
    doc.setFillColor(255, 255, 255)
    doc.circle(cx, cy - 4.0, 3.5, "F")      // cabeça
    doc.ellipse(cx, cy + 5.5, 5.0, 3.5, "F") // ombros
  }

  // Nome + email — à direita da foto, centrados verticalmente com a foto
  const infoX    = photoX + photoSize + 3
  const infoMaxW = cw - (infoX - c1x) - 3
  // baseline do nome posicionada no centro vertical da foto (−0.5 mm para
  // compensar o e-mail abaixo, mantendo o bloco visualmente centrado)
  let infoY      = photoY + photoSize / 2 - 0.5

  doc.setFont("helvetica", "bold")
  doc.setFontSize(9.5)
  doc.setTextColor(...C.text)
  const nameLines = doc.splitTextToSize(meta.evaluatedName, infoMaxW) as string[]
  doc.text(nameLines, infoX, infoY)
  infoY += nameLines.length * 4.5

  if (meta.evaluatedEmail) {
    doc.setFont("helvetica", "normal")
    doc.setFontSize(6.2)
    doc.setTextColor(...C.muted)
    const emailLines = doc.splitTextToSize(meta.evaluatedEmail, infoMaxW) as string[]
    doc.text(emailLines, infoX, infoY)
  }

  // Card 2 — Avaliação (pontuação)
  const score = computePerformanceScorePercent(ev.selections)
  const scorePct = score ?? ev.pontuacaoPercent
  const scoreLabel = performanceScoreQualitativeLabel(scorePct ?? null)
  const c2x = c1x + cw + cardGap

  drawCard(doc, c2x, y, cw, infoH, 3)
  doc.setFont("helvetica", "normal")
  doc.setFontSize(10.5)
  doc.setTextColor(...C.muted)
  doc.text("Avaliação", c2x + cw / 2, y + 9, { align: "center" })

  if (scorePct != null) {
    doc.setFont("helvetica", "bold")
    doc.setFontSize(16)
    doc.setTextColor(...scoreRgb(scorePct))
    doc.text(`${scorePct.toFixed(0)}%`, c2x + cw / 2, y + 17, { align: "center" })
    doc.setFont("helvetica", "normal")
    doc.setFontSize(7.5)
    doc.setTextColor(...C.muted)
    doc.text(scoreLabel, c2x + cw / 2, y + 23, { align: "center" })
  } else {
    doc.setFont("helvetica", "bold")
    doc.setFontSize(16)
    doc.setTextColor(...C.muted)
    doc.text("—", c2x + cw / 2, y + 17, { align: "center" })
  }

  // Card 3 — Data e período
  const c3x = c2x + cw + cardGap

  drawCard(doc, c3x, y, cw, infoH, 3)
  doc.setFont("helvetica", "normal")
  doc.setFontSize(10.5)
  doc.setTextColor(...C.muted)
  doc.text("Data e período", c3x + cw / 2, y + 9, { align: "center" })

  doc.setFont("helvetica", "bold")
  doc.setFontSize(16)
  doc.setTextColor(...C.text)
  doc.text(formatYmdPt(ev.dataYmd), c3x + cw / 2, y + 17, { align: "center" })

  doc.setFont("helvetica", "normal")
  doc.setFontSize(7.5)
  doc.setTextColor(...C.muted)
  doc.text(evaluationPeriodLabel(ev.periodo), c3x + cw / 2, y + 23, { align: "center" })

  y += infoH + 5 // y ≈ 80

  // ── 4. SEÇÕES + TABELAS ───────────────────────────────────────────────────
  const col0W = 52
  const levelColW = (innerW - col0W) / 5 // 26.8 mm
  const headRow = ["Competência", ...(EVALUATION_LEVEL_LABELS as unknown as string[])]

  for (let si = 0; si < PERFORMANCE_EVALUATION_SECTIONS.length; si++) {
    const section = PERFORMANCE_EVALUATION_SECTIONS[si]!
    const isLast = si === PERFORMANCE_EVALUATION_SECTIONS.length - 1

    // Cabeçalho de seção — texto bold verde sem fundo (igual ao web: text-lg font-semibold)
    doc.setFont("helvetica", "bold")
    doc.setFontSize(12)
    doc.setTextColor(...C.brand)
    doc.text(`${si + 1}. ${section.label}`, PAGE.l, y + 4.5)
    y += 8

    // Linhas da tabela (corpo)
    const body: string[][] = section.competencies.map((c) => {
      const lvl = ev.selections[c.id]
      const marks = EVALUATION_LEVEL_LABELS.map((_, i) => (lvl === i ? "✓" : ""))
      return [c.label, ...marks]
    })

    // Linha de rodapé: % por coluna de nível
    const total = section.competencies.length
    const levelCounts = ([0, 1, 2, 3, 4] as const).map(
      (lvl) => section.competencies.filter((c) => ev.selections[c.id] === lvl).length,
    )
    const footerRow = [
      "Pontuação (%)",
      ...levelCounts.map((cnt) => `${Math.round((cnt / total) * 100)}%`),
    ]

    autoTable(doc, {
      startY: y,
      margin: { left: PAGE.l, right: PAGE.r, top: 0, bottom: 0 },
      head: [headRow],
      body,
      foot: [footerRow],
      showFoot: "lastPage",
      theme: "plain",
      styles: {
        fontSize: 8,
        cellPadding: 1.1,
        lineColor: C.border,
        lineWidth: 0.12,
        textColor: C.text,
        valign: "middle",
        overflow: "linebreak",
      },
      headStyles: {
        fillColor: C.tableBg,
        textColor: [55, 65, 81],
        fontStyle: "bold",
        fontSize: 7,
        halign: "center",
        cellPadding: { top: 1.5, bottom: 1.5, left: 1, right: 1 },
      },
      footStyles: {
        fillColor: C.tableBg,
        textColor: C.muted,
        fontStyle: "bold",
        fontSize: 6.5,
        halign: "center",
        lineColor: C.border,
        lineWidth: 0.12,
      },
      columnStyles: {
        0: { halign: "left",   cellWidth: col0W    },
        1: { halign: "center", cellWidth: levelColW },
        2: { halign: "center", cellWidth: levelColW },
        3: { halign: "center", cellWidth: levelColW },
        4: { halign: "center", cellWidth: levelColW },
        5: { halign: "center", cellWidth: levelColW },
      },
      didParseCell: (data) => {
        const col = data.column.index
        if (col === 0) {
          data.cell.styles.fillColor = C.tableBg
          // "Competência" e "Pontuação (%)" sempre alinhados à esquerda
          if (data.section === "head" || data.section === "foot") {
            data.cell.styles.halign = "left"
          }
          if (data.section === "foot") {
            data.cell.styles.textColor = C.muted
          }
          return
        }
        const lvl = col - 1
        const fillBase = LEVEL_FILL[lvl]!
        const textBase = LEVEL_TEXT_COLOR[lvl]!
        if (data.section === "head") {
          data.cell.styles.fillColor = fillBase
          data.cell.styles.textColor = textBase
        } else if (data.section === "body") {
          // Versão mais clara para células do corpo
          const lighten = (n: number) =>
            Math.min(255, Math.round(n + (255 - n) * 0.58))
          data.cell.styles.fillColor = [
            lighten(fillBase[0]),
            lighten(fillBase[1]),
            lighten(fillBase[2]),
          ] as [number, number, number]
          if (data.cell.raw === "✓") {
            // jsPDF Helvetica não suporta U+2713 — suprime o texto e deixa o
            // didDrawCell desenhar o checkmark manualmente com doc.line()
            data.cell.text = []
          }
        } else if (data.section === "foot") {
          data.cell.styles.fillColor = fillBase
          data.cell.styles.textColor = textBase
          data.cell.styles.fontStyle = "bold"
        }
      },
      didDrawCell: (data) => {
        const col = data.column.index
        if (data.section === "body" && col >= 1 && data.cell.raw === "✓") {
          const lvl = col - 1
          const tc = LEVEL_TEXT_COLOR[lvl]!
          const cx = data.cell.x + data.cell.width / 2
          const cy = data.cell.y + data.cell.height / 2
          const s = 1.3
          doc.setDrawColor(...tc)
          doc.setLineWidth(0.55)
          // Traço esquerdo (curto, descendo): canto superior-esquerdo → fundo
          doc.line(cx - s, cy, cx - s * 0.15, cy + s * 0.65)
          // Traço direito (longo, subindo): fundo → canto superior-direito
          doc.line(cx - s * 0.15, cy + s * 0.65, cx + s, cy - s * 0.55)
        }
      },
      tableLineWidth: 0.15,
      tableLineColor: C.border,
      showHead: "everyPage",
    })

    const d = doc as DocWithTable
    y = (d.lastAutoTable?.finalY ?? y) + (isLast ? 0 : 4)
  }

  // ── 5. RODAPÉ DA PÁGINA ──────────────────────────────────────────────────
  doc.setFont("helvetica", "normal")
  doc.setFontSize(6.8)
  doc.setTextColor(...C.faint)
  doc.text(
    `QAgrotis - Gerado em ${nowStr} - Avaliador: ${meta.evaluatorName}`,
    pageW / 2,
    pageH - PAGE.b + 4,
    { align: "center" },
  )

  const out = doc.output("arraybuffer")
  return Buffer.from(new Uint8Array(out as ArrayBuffer))
}
